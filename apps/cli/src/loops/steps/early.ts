/**
 * Proposta antecipada: enquanto o apply implementa a etapa N, uma sessão do
 * Claude em paralelo escreve a change da etapa N+1, só na pasta OpenSpec dela.
 * O commit da entrega de N espera essa sessão e commita a change de N+1; na
 * iteração seguinte, o propose só revisa a proposta contra o código entregue.
 *
 * Nada disso pode travar a etapa N: se a sessão falhar, ou se o processo cair e
 * sobrar uma pasta não versionada, a sobra é apagada e a etapa N+1 é proposta do
 * jeito normal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { claudeSession } from '../claude.js';
import { TRAILER } from '../config.js';
import { errorMessage, oneLine } from '../format.js';
import { commitPaths, git, head, short } from '../git.js';
import { artifacts, changeDir } from '../openspec.js';
import { usesReadySpec } from '../plan.js';
import { buildPrompt, PROPOSAL_SCHEMA } from '../prompts.js';
import type { Briefing, Loop, LoopStage } from '../types.js';
import { proposalMessage } from './commits.js';
import { Cancelled, type IterationContext } from './context.js';
import { proposalFromAnswer, proposalValues } from './propose.js';

type Outcome = { ok: true; proposal: Briefing } | { ok: false; reason: string };

export interface EarlyProposalRun {
  stage: LoopStage;
  /** HEAD quando a sessão começou. */
  base: string;
  end: Promise<Outcome>;
  cancel: () => void;
}

/** A etapa seguinte à da iteração, se ainda pendente, sem proposta antecipada e sem spec já criada. */
export function stageToAnticipate(loop: Loop, currentNumber: number): LoopStage | undefined {
  const next = loop.stages[loop.stages.findIndex((stage) => stage.number === currentNumber) + 1];
  return next && next.status !== 'delivered' && !next.early && !usesReadySpec(next) ? next : undefined;
}

/**
 * Apaga a pasta da change quando foi a antecipação que a criou (marca no
 * loop.json) e nada dela está no git: sobra de uma antecipação que não
 * terminou. Uma pasta que outra pessoa criou nunca é apagada.
 */
export function discardLeftover(ctx: IterationContext, stage: LoopStage): boolean {
  const iteration = ctx.state.loop.iteration;
  if (iteration?.anticipating !== stage.change) return false;
  iteration.anticipating = undefined;
  ctx.save();
  const relative = `openspec/changes/${stage.change}`;
  if (!fs.existsSync(path.join(ctx.paths.root, relative)) || git(ctx.paths.root, ['ls-files', '--', relative]))
    return false;
  fs.rmSync(path.join(ctx.paths.root, relative), { recursive: true, force: true });
  ctx.monitor.log(
    'warn',
    `apagou a proposta antecipada incompleta de ${stage.change}; ela será proposta na iteração dela`,
  );
  return true;
}

/** Começa a proposta da próxima etapa em paralelo. Não espera: o commit da entrega é que espera. */
export function startEarlyProposal(ctx: IterationContext): EarlyProposalRun | undefined {
  if (!ctx.config.steps.includes('propose')) return;
  const stage = stageToAnticipate(ctx.state.loop, ctx.stage.number);
  if (!stage) return;
  const root = ctx.paths.root;
  discardLeftover(ctx, stage);
  // criada por outra pessoa ou versionada por uma execução anterior: a iteração dela completa
  if (fs.existsSync(changeDir(root, stage.change))) return;
  const iteration = ctx.state.loop.iteration;
  if (iteration) {
    iteration.anticipating = stage.change;
    ctx.save();
  }

  const control = new AbortController();
  const forward = () => control.abort();
  ctx.signal.addEventListener('abort', forward);
  const { limits } = ctx.config;
  const scope = ctx.config.scope.map((p) => path.join(root, p));
  ctx.monitor.log('info', `em paralelo: proposta antecipada da etapa ${stage.number} · ${stage.change}`);
  ctx.monitor.parallel(`proposta antecipada da etapa ${stage.number} · ${stage.change}`);
  const end = claudeSession({
    label: `antecipar-${stage.number}`,
    prompt: buildPrompt('antecipar', { ...proposalValues(ctx, stage), ANTERIOR: ctx.stage.change }),
    dir: ctx.dir,
    root,
    system: ctx.system,
    // o código é da sessão do apply: esta só escreve na pasta OpenSpec da próxima change
    forbidden: [
      ...ctx.forbidden,
      ...scope.flatMap((p) => [`Edit(/${p}/**)`, `Write(/${p}/**)`, `NotebookEdit(/${p}/**)`]),
    ],
    model: ctx.config.model,
    schema: PROPOSAL_SCHEMA,
    timeoutMs: limits.sessionMin * 60_000,
    idleMs: limits.sessionIdleMin * 60_000,
    signal: control.signal,
    onAttemptEnd: (summary) => ctx.monitor.recordParallelSession(summary),
  })
    .then((result): Outcome => {
      if (!result.ok) return { ok: false, reason: result.error ?? 'a sessão falhou' };
      const a = artifacts(root, stage.change);
      if (!a.proposal || !a.tasks) return { ok: false, reason: 'a sessão não gerou proposal.md e tasks.md' };
      return { ok: true, proposal: proposalFromAnswer(stage, result.result?.structured_output) };
    })
    // um erro aqui não pode virar unhandledRejection: derrubaria a iteração da etapa atual
    .catch((error): Outcome => ({ ok: false, reason: errorMessage(error) }))
    .finally(() => ctx.signal.removeEventListener('abort', forward));
  return { stage, base: head(root), end, cancel: () => control.abort() };
}

/**
 * Fecha a antecipação antes do commit da entrega: espera a sessão, commita só a
 * pasta da change seguinte e marca a etapa no loop.json (que entra no commit da
 * entrega). Sem antecipação em memória (processo novo depois de um crash), só
 * apaga a sobra não versionada, para a próxima iteração começar limpa.
 */
export async function finishEarlyProposal(ctx: IterationContext): Promise<void> {
  const early = ctx.early;
  if (!early) {
    const next = stageToAnticipate(ctx.state.loop, ctx.stage.number);
    if (next) discardLeftover(ctx, next);
    return;
  }
  const item = ctx.monitor.item(
    'early',
    `Proposta antecipada da etapa ${early.stage.number}`,
    'running',
    'esperando a sessão em paralelo',
  );
  const outcome = await early.end;
  ctx.early = undefined;
  ctx.monitor.parallel(undefined);
  if (ctx.signal.aborted) throw new Cancelled();
  if (!outcome.ok) {
    item.warn(`descartada: ${oneLine(outcome.reason, 80)}`);
    discardLeftover(ctx, early.stage);
    return;
  }
  const root = ctx.paths.root;
  const message = proposalMessage(early.stage, outcome.proposal);
  let result;
  try {
    result = commitPaths(root, message, [`openspec/changes/${early.stage.change}`], TRAILER);
  } catch (error) {
    item.warn(`descartada: git commit falhou (${oneLine(errorMessage(error), 60)})`);
    discardLeftover(ctx, early.stage);
    return;
  }
  const iteration = ctx.state.loop.iteration;
  if (iteration) iteration.anticipating = undefined;
  if (!result) {
    ctx.save();
    item.skipped('nada para commitar');
    return;
  }
  const stage = ctx.state.loop.stages.find((s) => s.number === early.stage.number);
  if (stage)
    stage.early = {
      title: outcome.proposal.title,
      comparison: outcome.proposal.comparison,
      base: early.base,
      commit: result.hash,
      at: new Date().toISOString(),
    };
  ctx.state.loop.totals.commits++;
  ctx.save();
  item.ok(`${short(result.hash)} · ${early.stage.change}`);
  ctx.monitor.event('commit', { hash: result.hash, message: message.split('\n')[0], files: result.files.length });
  ctx.monitor.log(
    'ok',
    `proposta antecipada de ${early.stage.change} commitada (${short(result.hash)}); a iteração dela só vai revisá-la`,
  );
}
