import fs from 'node:fs';
import path from 'node:path';
import { withoutCommitPrefix } from '../format.js';
import { short } from '../git.js';
import { usesReadySpec } from '../plan.js';
import { BRIEFING_SCHEMA, buildPrompt } from '../prompts.js';
import type { Briefing, Loop, LoopStage } from '../types.js';
import { claude } from './common.js';
import { iterationOf, type Step, StepFailure } from './context.js';

/**
 * Valida a resposta do Claude. Etapa, change e fase vêm do plano: o Claude só
 * contribui com título, comparação e briefing. Assim o loop nunca divide, junta
 * ou pula etapas, mesmo que a resposta sugira outra change.
 */
export function buildBriefing(stage: LoopStage, answer: unknown): { error?: string; briefing?: Briefing } {
  const x = answer as Partial<Briefing> | undefined;
  if (!x?.description?.trim()) return { error: 'briefing sem descrição' };
  return {
    briefing: {
      title: withoutCommitPrefix(x.title?.trim() || stage.title),
      comparison: x.comparison?.trim() ?? '',
      description: x.description.trim(),
    },
  };
}

/** O que o loop já entregou, para o briefing e a proposta saberem de onde partir. */
export function deliveriesText(loop: Loop): string {
  const delivered = loop.stages.filter((stage) => stage.status === 'delivered');
  if (!delivered.length) return '   (nenhuma etapa entregue ainda)';
  return delivered
    .map(
      (stage) =>
        `   - Etapa ${stage.number} · \`${stage.change}\` · ${stage.title}${stage.commit ? ` · commit ${short(stage.commit)}` : ''}`,
    )
    .join('\n');
}

/** Passo opcional (fora do padrão): o propose já estuda a etapa sozinho; este gasta uma sessão a mais. */
export const briefing: Step = {
  id: 'briefing',
  success: 'a iteração tem um briefing com descrição (resposta estruturada do passo de briefing)',
  async postcondition(ctx) {
    return iterationOf(ctx).briefing?.description?.trim() ? [] : ['a iteração não tem briefing'];
  },
  async execute(ctx) {
    const iteration = iterationOf(ctx);
    const early = ctx.state.loop.stages.find((stage) => stage.number === ctx.stage.number)?.early;
    if (usesReadySpec(ctx.stage)) {
      iteration.briefing = {
        title: ctx.stage.title,
        comparison: '',
        description: `spec já criada em openspec/changes/${ctx.stage.change}/`,
      };
      ctx.save();
      return 'skipped';
    }
    if (early) {
      // a change já foi escrita em paralelo à etapa anterior: o propose só a revisa
      iteration.briefing = {
        title: early.title,
        comparison: early.comparison,
        description: `proposta antecipada em openspec/changes/${ctx.stage.change}/`,
      };
      ctx.save();
      ctx.monitor.setIteration({ title: early.title });
      return 'skipped';
    }
    const total = ctx.state.loop.stages.length;
    ctx.monitor.item('stage', 'Etapa da vez', 'ok', `${ctx.stage.number} de ${total} · ${ctx.stage.change}`);

    const session = ctx.monitor.item('session', 'Claude lê o plano e o código e escreve o briefing (só leitura)');
    const end = await claude(
      ctx,
      'briefing',
      buildPrompt('briefing', { ...ctx.values, ITERACAO: iteration.number, ENTREGUES: deliveriesText(ctx.state.loop) }),
      {
        schema: BRIEFING_SCHEMA,
        extraForbidden: ['Edit', 'Write', 'NotebookEdit'],
      },
    );
    session.ok(`${end.result?.num_turns ?? 0} turnos`);

    const validate = ctx.monitor.item('validate', 'Validar o briefing');
    const { error, briefing: result } = buildBriefing(ctx.stage, end.result?.structured_output);
    fs.writeFileSync(
      path.join(ctx.dir, 'briefing.json'),
      JSON.stringify(result ?? end.result?.structured_output ?? null, null, 2),
    );
    if (error || !result) {
      validate.failed(error);
      throw new StepFailure(`briefing inválido: ${error}`, { file: end.file });
    }
    validate.ok(result.title);
    iteration.briefing = result;
    ctx.save();
    ctx.monitor.setIteration({ title: result.title });
    if (result.comparison) ctx.monitor.log('info', `ponto de partida: ${result.comparison}`);
    ctx.monitor.event('briefing', { change: ctx.stage.change, title: result.title });
  },
};
