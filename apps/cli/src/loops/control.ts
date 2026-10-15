/**
 * O que o CLI faz com um loop: conferir, iniciar (vigia destacado), pausar,
 * parar, aprovar e descartar. O CLI só escreve no loop.json quando não há vigia
 * vivo; com o loop rodando, ele fala com o vigia por controle.json e sinais.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BASIC_COMMANDS, effectiveConfig, loopsRoot } from './config.js';
import { readJson, readTail, writeJson } from './files.js';
import { errorMessage } from './format.js';
import { pathspecsThatMustBeClean, pendingReadySpecs, status } from './git.js';
import { liveLock } from './lock.js';
import {
  approvePlan,
  listLoops,
  type LoopPaths,
  loopPaths,
  markArchived,
  nextStage,
  planDivergences,
  readLoop,
  readLoopPlan,
  saveLoop,
} from './loops.js';
import { nodeCommand, WATCHER_FILE } from './node.js';
import { changeExists } from './openspec.js';
import { type Plan, validatePlan } from './plan.js';
import { sleep } from './process.js';
import { pathForLoop } from './shell-path.js';
import { resolveSteps } from './steps/registry.js';
import type { Control } from './types.js';

export interface Preflight {
  problems: string[];
  warnings: string[];
  /** PATH com que o vigia (e tudo o que ele roda) vai subir. */
  path?: string;
}

/** Dois escopos se sobrepõem quando um contém o outro. */
export function overlappingScopes(a: string[], b: string[]): string[] {
  const norm = (p: string) => `${p.replace(/\/+$/, '')}/`;
  return a.filter((x) => b.some((y) => norm(x).startsWith(norm(y)) || norm(y).startsWith(norm(x))));
}

/** Pré-requisitos para iniciar ou continuar: o que impede (problems) e o que só preocupa (warnings). */
export function preflight(name: string, root = loopsRoot()): Preflight {
  const paths = loopPaths(name, root);
  const problems: string[] = [];
  const warnings: string[] = [];
  let loop;
  try {
    loop = readLoop(paths);
  } catch (error) {
    return { problems: [errorMessage(error)], warnings };
  }
  const watcher = liveLock(paths.lock);
  if (watcher) problems.push(`o loop já está em execução (vigia pid ${watcher})`);
  if (loop.status === 'draft') problems.push('o plano ainda é um rascunho: revise e aprove antes de iniciar');

  let plan: Plan | undefined;
  try {
    plan = readLoopPlan(paths);
  } catch {
    problems.push('plano.md não encontrado');
  }
  if (plan && loop.status !== 'draft') {
    problems.push(...validatePlan(plan, name, (change) => changeExists(root, change)).map((p) => `plano.md: ${p}`));
    const divergences = planDivergences(loop, plan);
    if (divergences.length)
      problems.push(`o plano.md mudou desde a aprovação (${divergences.length} diferença(s)): aprove de novo`);
  }
  const config = effectiveConfig(loop.config);
  problems.push(...resolveSteps(config.steps).errors);
  const environment = pathForLoop([...BASIC_COMMANDS, ...config.requiredCommands]);
  if (environment.missing.length) {
    problems.push(
      `comandos fora do PATH: ${environment.missing.join(', ')} (procurados no PATH do CLI e no do seu shell, $SHELL -ilc)`,
    );
  }

  markArchived(loop, root);
  if (loop.status !== 'draft' && !loop.iteration && !nextStage(loop))
    problems.push('todas as etapas do plano já foram entregues');
  if (!loop.iteration) {
    try {
      const dirty = status(root, pathspecsThatMustBeClean(config.scope, name, pendingReadySpecs(loop.stages)));
      if (dirty.length)
        problems.push(
          `há alterações não commitadas no escopo do loop: ${dirty.slice(0, 6).join(', ')}${dirty.length > 6 ? '…' : ''}`,
        );
    } catch (error) {
      problems.push(`git status falhou: ${errorMessage(error).split('\n')[0]}`);
    }
  }
  for (const dir of config.scope)
    if (!fs.existsSync(path.join(root, dir))) warnings.push(`a pasta do escopo ${dir} não existe`);
  for (const other of listLoops(root)) {
    if (other.name === name || !other.watcher || !other.loop) continue;
    const common = overlappingScopes(config.scope, other.loop.config.scope);
    if (common.length) warnings.push(`o loop ${other.name}, em execução, também trabalha em ${common.join(', ')}`);
  }
  return { problems, warnings, path: environment.path };
}

export interface StartResult extends Preflight {
  pid?: number;
}

/** Confere e sobe o vigia destacado do CLI. Espera a trava aparecer para confirmar que ele subiu. */
export async function startLoop(name: string, root = loopsRoot()): Promise<StartResult> {
  const check = preflight(name, root);
  if (check.problems.length) return check;
  const paths = loopPaths(name, root);
  const loop = readLoop(paths);
  if (markArchived(loop, root)) saveLoop(paths, loop);
  writeJson(paths.control, { pause: false } satisfies Control);
  fs.mkdirSync(paths.run, { recursive: true });
  const log = fs.openSync(paths.log, 'a');
  try {
    const { command, args } = nodeCommand(WATCHER_FILE, [name]);
    const watcher = spawn(command, args, {
      cwd: root,
      detached: true,
      stdio: ['ignore', log, log],
      // eslint-disable-next-line turbo/no-undeclared-env-vars -- PATH do processo, não input de build
      env: { ...process.env, PATH: check.path ?? process.env.PATH, LOOPS_ROOT: root },
    });
    watcher.unref();
  } finally {
    fs.closeSync(log);
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const pid = liveLock(paths.lock);
    if (pid) return { ...check, pid };
    await sleep(100);
  }
  const tail = readTail(paths.log, 4096).slice(-8).join('\n');
  return { ...check, problems: [`o vigia não subiu. Final de ${paths.log}:\n${tail}`] };
}

export function readControl(paths: LoopPaths): Control {
  const read = readJson<Control>(paths.control);
  return read.ok ? read.value : { pause: false };
}

/** Pede (ou cancela) a pausa ao fim do passo atual. */
export function requestPause(name: string, pause: boolean, root = loopsRoot()) {
  const paths = loopPaths(name, root);
  writeJson(paths.control, { pause, requestedAt: new Date().toISOString() } satisfies Control);
}

/** Parar agora: SIGTERM no vigia, que encerra a iteração e os filhos e grava o estado. */
export function stopNow(name: string, root = loopsRoot()): boolean {
  const pid = liveLock(loopPaths(name, root).lock);
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

/** Aprova (ou reaprova) o plano.md. Só com o loop parado. */
export function approve(name: string, root = loopsRoot()): string[] {
  const paths = loopPaths(name, root);
  if (liveLock(paths.lock)) return ['o loop está em execução: pare ou pause antes de aprovar o plano de novo'];
  let plan: Plan;
  try {
    plan = readLoopPlan(paths);
  } catch {
    return ['plano.md não encontrado'];
  }
  const result = approvePlan(readLoop(paths), plan, root);
  if (!result.loop) return result.errors;
  markArchived(result.loop, root);
  saveLoop(paths, result.loop);
  return [];
}

/** Apaga a pasta de um rascunho (nunca de um loop aprovado). */
export function discardDraft(name: string, root = loopsRoot()): string | undefined {
  const paths = loopPaths(name, root);
  if (readLoop(paths).status !== 'draft') return 'só rascunhos podem ser descartados';
  fs.rmSync(paths.dir, { recursive: true, force: true });
  return undefined;
}
