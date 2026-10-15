import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_STEPS, loopsRoot } from './config.js';
import { readJson, writeJson } from './files.js';
import { liveLock } from './lock.js';
import { archivedDir, changeExists, type PendingSpec, pendingSpecs } from './openspec.js';
import { parsePlan, type Plan, planStages, validatePlan } from './plan.js';
import { LOOP_FORMAT, type Loop, type LoopStage, type LoopStatus, type Totals } from './types.js';

export interface LoopPaths {
  root: string;
  name: string;
  dir: string;
  plan: string;
  loop: string;
  run: string;
  lock: string;
  control: string;
  live: string;
  events: string;
  log: string;
  children: string;
}

export const loopsDir = (root = loopsRoot()) => path.join(root, 'openspec/loops');

export function loopPaths(name: string, root = loopsRoot()): LoopPaths {
  const dir = path.join(loopsDir(root), name);
  const run = path.join(dir, '.execucao');
  return {
    root,
    name,
    dir,
    plan: path.join(dir, 'plano.md'),
    loop: path.join(dir, 'loop.json'),
    run,
    lock: path.join(run, 'vigia.lock'),
    control: path.join(run, 'controle.json'),
    live: path.join(run, 'agora.json'),
    events: path.join(run, 'eventos.jsonl'),
    log: path.join(run, 'vigia.log'),
    children: path.join(run, 'filhos.json'),
  };
}

/** Pasta da iteração NN, com streams do Claude, logs das verificações e relatórios de falha. */
export const iterationDir = (paths: LoopPaths, number: number) =>
  path.join(paths.run, `iteracao-${String(number).padStart(2, '0')}`);

export function validateLoopName(name: string, root = loopsRoot()): string | undefined {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return 'use só letras minúsculas, números e hífens (kebab-case)';
  if (name.length > 40) return 'use até 40 caracteres';
  if (fs.existsSync(path.join(loopsDir(root), name))) return `já existe openspec/loops/${name}`;
  return undefined;
}

export const zeroTotals = (): Totals => ({
  durationMs: 0,
  cost: 0,
  runs: 0,
  iterationsStarted: 0,
  iterationsDelivered: 0,
  claudeSessions: 0,
  turns: 0,
  checks: 0,
  fixes: 0,
  recoveries: 0,
  recoveriesResolved: 0,
  failures: 0,
  restarts: 0,
  commits: 0,
});

export const LOOP_STATUSES: LoopStatus[] = [
  'draft',
  'pending',
  'running',
  'waiting',
  'paused',
  'failed',
  'interrupted',
  'done',
];

/**
 * Completa o que faltar num loop.json lido do disco (campos novos de versões
 * futuras do formato 1, arquivos editados à mão). Lança se não for um loop.
 */
export function normalizeLoop(raw: unknown, name: string): Loop {
  const x = raw as Partial<Loop> | null;
  if (!x || typeof x !== 'object') throw new Error('loop.json inválido');
  if (typeof x.format !== 'number') throw new Error('loop.json sem "format"');
  if (x.format > LOOP_FORMAT) throw new Error(`formato desconhecido (${x.format}); atualize o CLI`);
  const config = (x.config ?? {}) as Partial<Loop['config']>;
  return {
    format: x.format,
    name: x.name || name,
    title: x.title || name,
    createdAt: x.createdAt || new Date(0).toISOString(),
    status: LOOP_STATUSES.includes(x.status as LoopStatus) ? (x.status as LoopStatus) : 'pending',
    config: {
      model: config.model ?? '',
      scope: Array.isArray(config.scope) ? config.scope : [],
      commitPrefix: config.commitPrefix || 'feat',
      requiredCommands: Array.isArray(config.requiredCommands) ? config.requiredCommands : [],
      checks: Array.isArray(config.checks) ? config.checks : [],
      forbiddenTools: Array.isArray(config.forbiddenTools) ? config.forbiddenTools : [],
      steps: Array.isArray(config.steps) && config.steps.length ? config.steps : [...DEFAULT_STEPS],
      limits: config.limits ?? {},
    },
    stages: Array.isArray(x.stages) ? x.stages : [],
    iteration: x.iteration ?? null,
    totals: { ...zeroTotals(), ...(x.totals ?? {}) },
    lastRun: x.lastRun,
  };
}

/** Lê e normaliza o loop.json. Lança com uma mensagem curta se não der. */
export function readLoop(paths: LoopPaths): Loop {
  const read = readJson(paths.loop);
  if (!read.ok) throw new Error(read.error === 'missing' ? 'loop.json não encontrado' : 'loop.json inválido');
  return normalizeLoop(read.value, paths.name);
}

export const saveLoop = (paths: LoopPaths, loop: Loop) => writeJson(paths.loop, loop);

export function readLoopPlan(paths: LoopPaths): Plan {
  return parsePlan(fs.readFileSync(paths.plan, 'utf8'));
}

/** O status que vale: `running` precisa de vigia vivo, e um vigia vivo é sempre `running`. */
export function effectiveStatus(status: LoopStatus, watcherAlive: boolean): LoopStatus {
  if (watcherAlive) return 'running';
  return status === 'running' ? 'interrupted' : status;
}

export interface LoopListItem {
  name: string;
  paths: LoopPaths;
  loop?: Loop;
  error?: string;
  watcher: number | null;
  status?: LoopStatus;
}

/** Todos os loops do projeto. Uma pasta com problema vira um item com erro, sem derrubar a lista. */
export function listLoops(root = loopsRoot()): LoopListItem[] {
  const dir = loopsDir(root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const paths = loopPaths(entry.name, root);
      const watcher = liveLock(paths.lock);
      try {
        const loop = readLoop(paths);
        return { name: entry.name, paths, loop, watcher, status: effectiveStatus(loop.status, watcher !== null) };
      } catch (error) {
        return { name: entry.name, paths, watcher, error: error instanceof Error ? error.message : String(error) };
      }
    });
}

// ─── aprovação do plano ──────────────────────────────────────────────────────

/** Diferenças entre o plano.md e as etapas aprovadas no loop.json. Vazio = iguais. */
export function planDivergences(loop: Loop, plan: Plan): string[] {
  const fromPlan = planStages(plan);
  const differences: string[] = [];
  const total = Math.max(fromPlan.length, loop.stages.length);
  for (let index = 0; index < total; index++) {
    const p = fromPlan[index];
    const a = loop.stages[index];
    if (p && !a) differences.push(`etapa ${p.number} nova: ${p.title} (${p.change})`);
    else if (a && !p) differences.push(`etapa ${a.number} removida: ${a.title} (${a.change})`);
    else if (a && p) {
      const fields: string[] = (['number', 'phase', 'title', 'change'] as const)
        .filter((key) => p[key] !== a[key])
        .map((key) => FIELD_LABEL[key]);
      if (!!p.readySpec !== !!a.readySpec) fields.push('spec pronta');
      if (fields.length) differences.push(`etapa ${a.number} mudou (${fields.join(', ')}): ${p.title} (${p.change})`);
    }
  }
  return differences;
}

const FIELD_LABEL = { number: 'número', phase: 'fase', title: 'título', change: 'change' } as const;

/**
 * Congela as etapas do plano no loop, preservando o progresso das já entregues.
 * Recusa plano inválido e edição que remove ou renomeia etapa entregue.
 */
export function approvePlan(loop: Loop, plan: Plan, root = loopsRoot()): { errors: string[]; loop?: Loop } {
  const errors = validatePlan(plan, loop.name, (change) => changeExists(root, change));
  if (errors.length) return { errors };
  const fromPlan = planStages(plan);
  for (const delivered of loop.stages.filter((stage) => stage.status === 'delivered')) {
    const same = fromPlan.find((stage) => stage.number === delivered.number);
    if (!same || same.change !== delivered.change) {
      errors.push(
        `a etapa ${delivered.number} já foi entregue como "${delivered.change}" e não pode ser removida nem renomeada`,
      );
    }
  }
  if (errors.length) return { errors };
  const stages: LoopStage[] = fromPlan.map((stage) => {
    const previous = loop.stages.find((a) => a.change === stage.change && a.number === stage.number);
    return {
      ...(previous ?? { status: 'pending' as const }),
      number: stage.number,
      phase: stage.phase,
      title: stage.title,
      change: stage.change,
      readySpec: stage.readySpec || undefined,
    };
  });
  const pending = stages.some((stage) => stage.status !== 'delivered');
  let status = loop.status;
  if (status === 'draft') status = 'pending';
  else if (status === 'done' && pending) status = 'paused';
  return { errors: [], loop: { ...loop, title: plan.title || loop.title, stages, status } };
}

/**
 * Marca como entregues as etapas cuja change já está arquivada no OpenSpec
 * (trabalho feito fora do loop, loop migrado). Retorna quantas mudaram.
 */
export function markArchived(loop: Loop, root: string): number {
  let changed = 0;
  for (const stage of loop.stages) {
    if (stage.status === 'delivered') continue;
    const archived = archivedDir(root, stage.change);
    if (!archived) continue;
    if (loop.iteration?.stage === stage.number) continue;
    stage.status = 'delivered';
    stage.deliveredAt ??= path.basename(archived).slice(0, 10);
    changed++;
  }
  if (changed && loop.stages.every((stage) => stage.status === 'delivered') && loop.status !== 'running')
    loop.status = 'done';
  return changed;
}

export const nextStage = (loop: Loop) => loop.stages.find((stage) => stage.status !== 'delivered');
export const deliveredStages = (loop: Loop) => loop.stages.filter((stage) => stage.status === 'delivered').length;

/**
 * Specs pendentes para um loop novo. A que já é etapa não entregue de outro loop
 * vem com o nome dele: dois loops aplicando a mesma change se atropelariam.
 */
export function specsForNewLoop(root = loopsRoot()): (PendingSpec & { inLoop?: string })[] {
  const inUse = new Map<string, string>();
  for (const item of listLoops(root)) {
    for (const stage of item.loop?.stages ?? []) if (stage.status !== 'delivered') inUse.set(stage.change, item.name);
  }
  return pendingSpecs(root).map((spec) => ({ ...spec, inLoop: inUse.get(spec.name) }));
}
