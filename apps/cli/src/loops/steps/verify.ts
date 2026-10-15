import { runChecks } from '../checks.js';
import { fixPrefix } from '../format.js';
import { status } from '../git.js';
import { commit, verifyWithFixes } from './common.js';
import type { IterationContext, Step } from './context.js';

const CHECKS_SUCCESS =
  'todas as verificações do loop passam (os comandos listados em "Como verificar" no prompt de sistema)';

/** Pós-condição dos passos de verificação: rodar as verificações de novo. Sem verificações, cumprida. */
async function checksPass(ctx: IterationContext): Promise<string[]> {
  const { config } = ctx;
  if (!config.checks.length) return [];
  const failure = await runChecks(config.checks, {
    root: ctx.paths.root,
    dir: ctx.dir,
    round: 'pós-condição',
    timeoutMs: config.limits.commandMin * 60_000,
    monitor: ctx.monitor,
    signal: ctx.signal,
  });
  return failure ? [`${failure.label} falha: ${failure.tail.slice(-3).join(' ')}`] : [];
}

export const baseline: Step = {
  id: 'baseline',
  success: CHECKS_SUCCESS,
  postcondition: checksPass,
  async execute(ctx) {
    const result = await verifyWithFixes(ctx, 'baseline');
    if (result === 'skipped') return result;
    // se o Claude consertou o ponto de partida, o conserto vira um commit próprio. Só
    // com correção: com `openspec` no escopo, a spec recém-proposta já deixa o escopo sujo
    if (result > 0 && status(ctx.paths.root, ctx.config.scope).length) {
      const fixed = commit(
        ctx,
        `${fixPrefix(ctx.config.commitPrefix)}: restaura as verificações antes de ${ctx.stage.change}`,
        true,
      );
      if (fixed) ctx.monitor.count('commits');
    }
  },
};

export const verifyChange: Step = {
  id: 'verifyChange',
  success: CHECKS_SUCCESS,
  postcondition: checksPass,
  async execute(ctx) {
    if ((await verifyWithFixes(ctx, 'delivery')) === 'skipped') return 'skipped';
  },
};
