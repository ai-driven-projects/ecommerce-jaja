import { errorMessage } from '../format.js';
import { status } from '../git.js';
import { archivedDir } from '../openspec.js';
import { usesReadySpec } from '../plan.js';
import type { Briefing, Iteration, Loop, LoopStage } from '../types.js';
import { commit } from './common.js';
import { iterationOf, type Step, StepFailure } from './context.js';
import { finishEarlyProposal } from './early.js';

export const proposalMessage = (stage: LoopStage, briefing?: Briefing) =>
  `docs(openspec): propõe ${stage.change}\n\n${briefing?.title ?? stage.title}`;

/** Spec escolhida na criação do loop: o commit só a traz para o loop (ela pode nem estar versionada). */
export const readySpecMessage = (stage: LoopStage, loop: string) =>
  `docs(openspec): adota ${stage.change} no loop ${loop}\n\n${stage.title}`;

/** A proposta antecipada já tem o commit dela: este registra só a revisão contra a etapa anterior. */
export const reviewMessage = (stage: LoopStage, briefing?: Briefing) =>
  `docs(openspec): revisa ${stage.change} contra a etapa anterior entregue\n\n${briefing?.title ?? stage.title}`;

export function deliveryMessage(options: {
  prefix: string;
  loop: string;
  stage: LoopStage;
  total: number;
  title: string;
  archived?: string;
}) {
  return `${options.prefix}: ${options.title}\n\nChange OpenSpec ${options.stage.change} (etapa ${options.stage.number} de ${options.total} do loop ${options.loop}), arquivada em ${options.archived ?? 'openspec/changes/archive/'}.`;
}

/** Marca a etapa como entregue e fecha a iteração (antes do commit, para o loop.json entrar nele). */
export function recordDelivery(loop: Loop, iteration: Iteration, now = new Date()) {
  const stage = loop.stages.find((s) => s.number === iteration.stage);
  if (!stage) return;
  stage.status = 'delivered';
  stage.iteration = iteration.number;
  stage.deliveredAt = now.toISOString();
  stage.durationMs = iteration.steps.reduce((sum, step) => sum + step.durationMs, 0);
  stage.cost = iteration.steps.reduce((sum, step) => sum + step.cost, 0);
  stage.steps = iteration.steps.map((step) => ({
    id: step.id,
    durationMs: step.durationMs,
    cost: step.cost,
    attempts: step.attempts,
  }));
  loop.iteration = null;
  loop.totals.iterationsDelivered++;
}

export const commitProposal: Step = {
  id: 'commitProposal',
  success: 'não há alteração pendente (git status) na pasta openspec/changes/<change>',
  async postcondition(ctx) {
    const pending = status(ctx.paths.root, [`openspec/changes/${ctx.stage.change}`]);
    return pending.length ? [`alterações não commitadas na change: ${pending.slice(0, 5).join(', ')}`] : [];
  },
  async execute(ctx) {
    const loop = ctx.state.loop;
    const early = loop.stages.find((stage) => stage.number === ctx.stage.number)?.early;
    const message = usesReadySpec(ctx.stage)
      ? readySpecMessage(ctx.stage, loop.name)
      : (early ? reviewMessage : proposalMessage)(ctx.stage, iterationOf(ctx).briefing);
    const result = commit(ctx, message);
    if (result) ctx.monitor.count('commits');
  },
};

export const commitDelivery: Step = {
  id: 'commitDelivery',
  success: 'a etapa está entregue no loop.json e não há alteração pendente nas pastas do escopo',
  async postcondition(ctx) {
    const problems: string[] = [];
    const stage = ctx.state.loop.stages.find((s) => s.number === ctx.stage.number);
    if (stage?.status !== 'delivered') problems.push('a etapa ainda não está entregue no loop.json');
    const pending = status(ctx.paths.root, ctx.config.scope);
    if (pending.length) problems.push(`alterações não commitadas no escopo: ${pending.slice(0, 5).join(', ')}`);
    return problems;
  },
  async execute(ctx) {
    // antes de registrar a entrega: a marca da proposta antecipada entra no mesmo commit
    await finishEarlyProposal(ctx);
    const loop = ctx.state.loop;
    const iteration = iterationOf(ctx);
    ctx.monitor.accountTime();
    const before = structuredClone(loop);
    recordDelivery(loop, iteration);
    ctx.save();
    const message = deliveryMessage({
      prefix: ctx.config.commitPrefix,
      loop: loop.name,
      stage: ctx.stage,
      total: loop.stages.length,
      title: iteration.briefing?.title ?? ctx.stage.title,
      archived: archivedDir(ctx.paths.root, ctx.stage.change),
    });
    let hash: string | undefined;
    try {
      hash = commit(ctx, message)?.hash;
    } catch (error) {
      // sem commit, a etapa não foi entregue: volta o loop.json para retomar este passo
      ctx.state.loop = before;
      ctx.save();
      throw new StepFailure(`git commit falhou: ${errorMessage(error)}`);
    }
    const stage = loop.stages.find((s) => s.number === iteration.stage);
    if (stage && hash) stage.commit = hash;
    if (hash) loop.totals.commits++;
    ctx.save();
  },
};
