import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeSession } from './claude.js';
import { BASIC_COMMANDS, DEFAULT_LIMITS, DEFAULT_STEPS, GENERAL_FORBIDDEN_TOOLS, loopsRoot } from './config.js';
import { writeAtomic } from './files.js';
import { toKebab, twoDigits } from './format.js';
import { loopPaths, saveLoop, zeroTotals } from './loops.js';
import { changeExists, proposalSummary } from './openspec.js';
import { type Plan, type PlanPhase, renderPlan, validatePlan } from './plan.js';
import { buildPrompt, PLANNING_SCHEMA, SPECS_PLANNING_SCHEMA } from './prompts.js';
import { type Activity, type Check, LOOP_FORMAT, type Loop, type Totals } from './types.js';

interface ConfigAnswer {
  scope: string[];
  commitPrefix: string;
  requiredCommands: string[];
  checks: { label: string; command: string; dir: string }[];
}

export interface PlanningAnswer extends ConfigAnswer {
  title: string;
  rules: string;
  outOfScope: string;
  phases: { name: string; stages: { title: string; subject: string; description: string }[] }[];
}

export interface SpecsPlanningAnswer extends ConfigAnswer {
  title: string;
  goal: string;
  rules: string;
  outOfScope: string;
  stages: { change: string; title: string; description: string }[];
}

type BuildOptions = { root?: string; now?: Date; totals?: Partial<Totals> };
type Built = { errors: string[]; warnings: string[]; plan?: Plan; loop?: Loop };

/**
 * Monta o plano e o loop a partir da resposta do Claude. Os nomes de change são
 * gerados aqui (`<loop>-NN-<assunto>`), então o plano nasce sempre no formato.
 */
export function buildLoopFromPlanning(name: string, goal: string, answer: unknown, options: BuildOptions = {}): Built {
  const r = answer as Partial<PlanningAnswer> | undefined;
  if (!r || !Array.isArray(r.phases) || !r.phases.length)
    return { errors: ['a resposta do planejamento não trouxe fases'], warnings: [] };
  let number = 0;
  const phases: PlanPhase[] = r.phases.map((phase, index) => {
    const phaseName = (phase.name ?? '').trim() || `Fase ${index + 1}`;
    return {
      number: index + 1,
      name: phaseName,
      stages: (phase.stages ?? []).map((stage) => {
        number++;
        const subject =
          toKebab(stage.subject || stage.title || `etapa-${number}`)
            .split('-')
            .slice(0, 6)
            .join('-') || `etapa-${number}`;
        return {
          number,
          phase: phaseName,
          title: (stage.title ?? '').trim() || subject,
          change: `${name}-${twoDigits(number)}-${subject}`,
          description: (stage.description ?? '').replace(/\s+/g, ' ').trim(),
        };
      }),
    };
  });
  const plan: Plan = {
    title: (r.title ?? '').trim() || name,
    goal: goal.trim(),
    rules: (r.rules ?? '').trim(),
    outOfScope: (r.outOfScope ?? '').trim(),
    phases,
    loose: [],
  };
  const errors = validatePlan(plan, name);
  if (errors.length) return { errors, warnings: [] };
  return buildLoop(name, plan, r, options);
}

/**
 * Monta o plano e o loop de specs que já existem: as etapas são as changes, na
 * ordem que o usuário escolheu, com os nomes delas. Da resposta do Claude vêm só
 * títulos, descrições e o resto do plano; uma etapa que ele omitir ou trocar
 * fica com o nome da change e o resumo do proposal.
 */
export function buildLoopFromSpecs(name: string, specs: string[], answer: unknown, options: BuildOptions = {}): Built {
  const r = (answer ?? {}) as Partial<SpecsPlanningAnswer>;
  const root = options.root ?? loopsRoot();
  if (!specs.length) return { errors: ['nenhuma spec escolhida'], warnings: [] };
  const fromAnswer = new Map((Array.isArray(r.stages) ? r.stages : []).map((stage) => [stage?.change?.trim(), stage]));
  const phase = 'Specs existentes';
  const plan: Plan = {
    title: (r.title ?? '').trim() || name,
    goal: (r.goal ?? '').trim() || `Aplicar, nesta ordem, as specs já criadas: ${specs.join(', ')}.`,
    rules: (r.rules ?? '').trim(),
    outOfScope: (r.outOfScope ?? '').trim(),
    phases: [
      {
        number: 1,
        name: phase,
        stages: specs.map((change, index) => {
          const stage = fromAnswer.get(change);
          return {
            number: index + 1,
            phase,
            title: (stage?.title ?? '').trim() || change,
            change,
            description: (stage?.description ?? '').replace(/\s+/g, ' ').trim() || proposalSummary(root, change),
            readySpec: true,
          };
        }),
      },
    ],
    loose: [],
  };
  const errors = validatePlan(plan, name, (change) => changeExists(root, change));
  if (errors.length) return { errors, warnings: [] };
  return buildLoop(name, plan, r, options);
}

/** O loop.json em rascunho, com a configuração sugerida pelo Claude saneada. */
function buildLoop(name: string, plan: Plan, r: Partial<ConfigAnswer>, options: BuildOptions): Built {
  const warnings: string[] = [];
  const root = options.root ?? loopsRoot();
  const relative = (p: string) => p.replace(/^\.?\/+/, '').replace(/\/+$/, '');
  const scope = [
    ...new Set(
      (r.scope ?? [])
        .filter((p) => !path.isAbsolute(p))
        .map(relative)
        .filter((p) => p && !p.startsWith('..')),
    ),
  ];
  for (const dir of scope)
    if (!fs.existsSync(path.join(root, dir))) warnings.push(`a pasta do escopo ${dir} não existe ainda`);
  if (!scope.length) warnings.push('nenhuma pasta de código no escopo: os commits terão só os arquivos OpenSpec');
  const checks: Check[] = (r.checks ?? [])
    .filter((check) => check?.command?.trim())
    .map((check, index) => ({
      id: toKebab(check.label || `verificacao-${index + 1}`) || `verificacao-${index + 1}`,
      label: (check.label ?? '').trim() || check.command.trim(),
      command: check.command.trim().split(/\s+/),
      dir: relative(check.dir ?? '') || '.',
    }));
  if (!checks.length) warnings.push('nenhuma verificação: o loop não vai rodar build nem testes');

  const loop: Loop = {
    format: LOOP_FORMAT,
    name,
    title: plan.title,
    createdAt: (options.now ?? new Date()).toISOString(),
    status: 'draft',
    config: {
      model: '',
      scope,
      commitPrefix: (r.commitPrefix ?? '').trim() || 'feat',
      requiredCommands: [
        ...new Set((r.requiredCommands ?? []).map((x) => x.trim()).filter((x) => x && !BASIC_COMMANDS.includes(x))),
      ],
      checks,
      forbiddenTools: [],
      steps: [...DEFAULT_STEPS],
      limits: {},
    },
    stages: [],
    iteration: null,
    totals: { ...zeroTotals(), ...options.totals },
  };
  return { errors: [], warnings, plan, loop };
}

export interface PlanningOptions {
  name: string;
  goal: string;
  /** Changes já existentes, na ordem das etapas: o loop as aplica sem propor. Sem elas, o Claude planeja pelo objetivo. */
  specs?: string[];
  root?: string;
  model?: string;
  signal?: AbortSignal;
  onActivity?: (activity: Activity) => void;
  onLog?: (text: string) => void;
  onWait?: (text: string | undefined) => void;
  /** Custo acumulado das sessões até agora (para a tela mostrar). */
  onCost?: (cost: number) => void;
}

export type PlanningResult =
  { ok: true; loop: Loop; plan: Plan; warnings: string[] } | { ok: false; error: string; cancelled: boolean };

const PLANNING_SYSTEM =
  'Você está planejando um loop automático de desenvolvimento. Não altere nenhum arquivo. Escreva em português.';

/**
 * Sessão só de leitura que escreve o plano. A pasta do loop só é gravada quando
 * a resposta é válida, já como rascunho; uma resposta fora do formato é pedida
 * de novo uma vez.
 */
export async function planLoop(options: PlanningOptions): Promise<PlanningResult> {
  const root = options.root ?? loopsRoot();
  const specs = options.specs?.length ? options.specs : undefined;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `jaja-loop-${options.name}-`));
  const totals = { cost: 0, turns: 0, claudeSessions: 0, durationMs: 0 };
  let lastError = '';
  for (let round = 1; round <= 2; round++) {
    const end = await claudeSession({
      label: round === 1 ? 'planejar' : 'planejar-de-novo',
      prompt: specs
        ? buildPrompt('planejar-specs', {
            NOME: options.name,
            SPECS: specs.map((spec, index) => `${index + 1}. \`${spec}\` (openspec/changes/${spec}/)`).join('\n'),
          })
        : buildPrompt('planejar', { NOME: options.name, OBJETIVO: options.goal }),
      dir,
      root,
      system: PLANNING_SYSTEM,
      forbidden: [...GENERAL_FORBIDDEN_TOOLS, 'Edit', 'Write', 'NotebookEdit'],
      model: options.model,
      schema: specs ? SPECS_PLANNING_SCHEMA : PLANNING_SCHEMA,
      timeoutMs: DEFAULT_LIMITS.sessionMin * 60_000,
      idleMs: DEFAULT_LIMITS.sessionIdleMin * 60_000,
      signal: options.signal,
      onActivity: options.onActivity,
      onLog: options.onLog,
      onWait: options.onWait,
      onAttemptEnd: (summary) => {
        totals.cost += summary.cost;
        totals.turns += summary.turns;
        totals.claudeSessions++;
        totals.durationMs += summary.durationMs;
        options.onCost?.(totals.cost);
      },
    });
    if (end.cancelled) return { ok: false, error: 'planejamento cancelado', cancelled: true };
    if (!end.ok) {
      lastError = `a sessão de planejamento falhou: ${end.error}`;
      options.onLog?.(lastError);
      continue;
    }
    const answer = end.result?.structured_output;
    const built = specs
      ? buildLoopFromSpecs(options.name, specs, answer, { root, totals })
      : buildLoopFromPlanning(options.name, options.goal, answer, { root, totals });
    if (!built.loop || !built.plan) {
      lastError = `o plano veio fora do formato: ${built.errors.join('; ')}`;
      options.onLog?.(lastError);
      continue;
    }
    const paths = loopPaths(options.name, root);
    if (fs.existsSync(paths.dir))
      return { ok: false, error: `openspec/loops/${options.name} já existe`, cancelled: false };
    writeAtomic(paths.plan, renderPlan(built.plan));
    saveLoop(paths, built.loop);
    try {
      fs.cpSync(dir, path.join(paths.run, 'planejamento'), { recursive: true });
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // os streams do planejamento são só para consulta
    }
    return { ok: true, loop: built.loop, plan: built.plan, warnings: built.warnings };
  }
  return { ok: false, error: lastError || 'o planejamento falhou', cancelled: false };
}
