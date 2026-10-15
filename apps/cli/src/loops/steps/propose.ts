import fs from 'node:fs';
import path from 'node:path';
import { oneLine, withoutCommitPrefix } from '../format.js';
import { status } from '../git.js';
import { archivedDir, artifacts, changeDir, changeTasks, describeArtifacts } from '../openspec.js';
import { usesReadySpec } from '../plan.js';
import { run } from '../process.js';
import { buildPrompt, PROPOSAL_SCHEMA } from '../prompts.js';
import type { Briefing, Loop, LoopStage } from '../types.js';
import { deliveriesText } from './briefing.js';
import { claude, whilePending } from './common.js';
import { type IterationContext, iterationOf, NeedsHuman, type Step, StepFailure } from './context.js';

/** `openspec validate <nome> --strict`, usado pelo passo e pela pós-condição dele. */
export const validateChange = (root: string, name: string, signal?: AbortSignal) =>
  run('openspec', ['validate', name, '--strict', '--no-interactive'], { cwd: root, timeoutMs: 120_000, signal });

/**
 * Tamanho-alvo de uma change, em mil caracteres. Changes de mais de 100 mil
 * tomavam a maior parte do propose, e cada sessão do apply as relia inteiras.
 */
export const CHANGE_SIZE_TARGET_K = 40;

/** Caracteres de todos os .md da change (proposal, design, specs e tasks). */
export function changeSize(root: string, name: string): number {
  const sum = (dir: string): number =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).reduce((n, entry) => {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) return n + sum(full);
          return entry.name.endsWith('.md') ? n + fs.readFileSync(full, 'utf8').length : n;
        }, 0)
      : 0;
  return sum(changeDir(root, name));
}

/** A change arquivada mais recente do loop: o modelo de formato, no lugar de ler todas. */
export function formatReference(root: string, loop: Loop): string {
  const latest = loop.stages
    .filter((stage) => stage.status === 'delivered')
    .map((stage) => archivedDir(root, stage.change))
    .filter(Boolean)
    .pop();
  return latest
    ? `\`${latest}/\``
    : '(nenhuma ainda: siga o formato das specs em `openspec/specs/` e das changes em `openspec/changes/archive/`)';
}

/** Valores dos prompts de proposta de uma etapa: a da iteração ou, na antecipação, a seguinte. */
export function proposalValues(ctx: IterationContext, stage: LoopStage): Record<string, string | number> {
  const loop = ctx.state.loop;
  const values = {
    ...ctx.values,
    NOME: stage.change,
    NUMERO: stage.number,
    TITULO: stage.title,
    FASE: stage.phase,
    ENTREGUES: deliveriesText(loop),
    REFERENCIA: formatReference(ctx.paths.root, loop),
    TAMANHO: CHANGE_SIZE_TARGET_K,
  };
  return { ...values, REGRAS_DA_SPEC: buildPrompt('regras-da-spec', values) };
}

/** Título e ponto de partida vindos da resposta da proposta. Sem descrição: a change é o briefing. */
export function proposalFromAnswer(stage: LoopStage, answer: unknown): Briefing {
  const x = answer as Partial<Briefing> | undefined;
  return {
    title: withoutCommitPrefix(x?.title?.trim() || stage.title),
    comparison: x?.comparison?.trim() ?? '',
    description: '',
  };
}

/** A etapa antes desta no plano (a que a proposta antecipada não viu pronta). */
export const previousStage = (loop: Loop, number: number) =>
  loop.stages[loop.stages.findIndex((stage) => stage.number === number) - 1];

export const propose: Step = {
  id: 'propose',
  success: 'openspec/changes/<change>/ tem proposal.md e tasks.md, e `openspec validate <change> --strict` passa',
  async postcondition(ctx) {
    const a = artifacts(ctx.paths.root, ctx.stage.change);
    const missing = (['proposal', 'tasks'] as const).filter((key) => !a[key]).map((key) => `falta ${key}.md`);
    if (missing.length) return missing;
    const result = await validateChange(ctx.paths.root, ctx.stage.change, ctx.signal);
    return result.code === 0
      ? []
      : [`openspec validate --strict falha: ${oneLine(result.tail.slice(-3).join(' '), 200)}`];
  },
  async execute(ctx) {
    const root = ctx.paths.root;
    const name = ctx.stage.change;
    const iteration = iterationOf(ctx);
    const loop = ctx.state.loop;
    const early = loop.stages.find((stage) => stage.number === ctx.stage.number)?.early;
    const scopeBefore = status(root, ctx.config.scope);
    const setTitle = (briefing: Briefing) => {
      iteration.briefing = briefing;
      ctx.save();
      ctx.monitor.setIteration({ title: briefing.title });
    };

    const arts = ctx.monitor.item(
      'artifacts',
      'Artefatos da change',
      'running',
      describeArtifacts(artifacts(root, name)),
    );
    const follow = () => arts.detail(describeArtifacts(artifacts(root, name)));
    const readySpec = usesReadySpec(ctx.stage);
    if (readySpec) {
      // escolhida na criação do loop: nada a propor, só conferir antes de aplicar
      const a = artifacts(root, name);
      if (!a.proposal || !a.tasks) {
        arts.failed(describeArtifacts(a));
        throw new NeedsHuman(
          `a spec ${name}, escolhida na criação do loop, não tem proposal.md e tasks.md em openspec/changes/${name}`,
          `restaure a change ${name} (ou troque a etapa no plano.md e aprove de novo) e continue`,
        );
      }
      if (!iteration.briefing) setTitle({ title: ctx.stage.title, comparison: '', description: '' });
      ctx.monitor.item('session', 'Spec já criada: sem sessão de proposta', 'skipped', name);
    } else if (early && artifacts(root, name).proposal) {
      // escrita em paralelo à etapa anterior: só confere contra o código que ela entregou
      if (!iteration.briefing) setTitle({ title: early.title, comparison: early.comparison, description: '' });
      const session = ctx.monitor.item('session', 'Claude revisa a proposta antecipada contra o código entregue');
      const end = await whilePending(
        claude(
          ctx,
          'propor-revisao',
          buildPrompt('revisar', {
            ...ctx.values,
            ANTERIOR: previousStage(loop, ctx.stage.number)?.change ?? '(etapa anterior)',
            BASE: early.base,
          }),
        ),
        follow,
      );
      session.ok(`${end.result?.num_turns ?? 0} turnos`);
    } else {
      const session = ctx.monitor.item('session', 'Claude estuda a etapa e escreve a spec (/opsx:propose)');
      // loops com o passo de briefing antes deste
      const briefing = iteration.briefing?.description
        ? `\nBriefing vindo do passo anterior do loop:\n\n${iteration.briefing.description}\n`
        : '';
      const end = await whilePending(
        claude(ctx, 'propor', buildPrompt('propor', { ...proposalValues(ctx, ctx.stage), BRIEFING: briefing }), {
          schema: PROPOSAL_SCHEMA,
        }),
        follow,
      );
      session.ok(`${end.result?.num_turns ?? 0} turnos`);
      if (!iteration.briefing) {
        const proposal = proposalFromAnswer(ctx.stage, end.result?.structured_output);
        setTitle(proposal);
        if (proposal.comparison) ctx.monitor.log('info', `ponto de partida: ${proposal.comparison}`);
        ctx.monitor.event('briefing', { change: name, title: proposal.title });
      }
    }
    const a = artifacts(root, name);
    if (!a.tasks || !a.proposal) {
      arts.failed(describeArtifacts(a));
      throw new StepFailure(`a proposta não gerou os artefatos de openspec/changes/${name}`);
    }
    arts.ok(describeArtifacts(a));

    const validate = async (round: string) => {
      const item = ctx.monitor.item('validate', 'openspec validate --strict', 'running', round);
      const result = await validateChange(root, name, ctx.signal);
      if (result.code === 0) item.ok(round);
      else item.failed(oneLine(result.tail.slice(-3).join(' '), 120));
      return result;
    };
    let result = await validate('1ª rodada');
    if (result.code !== 0) {
      const adjust = ctx.monitor.item('adjust', 'Claude ajusta os artefatos');
      await claude(
        ctx,
        'propor-ajuste',
        `A change OpenSpec \`${name}\` não passa em \`openspec validate ${name} --strict\`:\n\n\`\`\`\n${result.tail.join('\n')}\n\`\`\`\n\nCorrija só os artefatos da change (sem implementar nada) até a validação passar.`,
      );
      adjust.ok();
      result = await validate('após ajuste');
      if (result.code !== 0)
        throw new StepFailure('a spec não passa em openspec validate --strict', { tail: result.tail });
    }
    const tasks = changeTasks(root, name);
    ctx.monitor.item('tasks', 'Tarefas planejadas', 'ok', `${tasks?.total ?? 0} tarefas`);
    const k = Math.round(changeSize(root, name) / 1000);
    const big = k > CHANGE_SIZE_TARGET_K * 1.5;
    ctx.monitor.item(
      'size',
      'Tamanho da change',
      big ? 'warn' : 'ok',
      `${k} mil caracteres (alvo: ${CHANGE_SIZE_TARGET_K} mil)`,
    );
    if (big)
      ctx.monitor.log(
        'warn',
        `a change tem ${k} mil caracteres, bem acima do alvo de ${CHANGE_SIZE_TARGET_K} mil: o apply vai reler tudo isso em cada sessão`,
      );
    const scopeAfter = status(root, ctx.config.scope);
    if (scopeAfter.some((line) => !scopeBefore.includes(line)))
      ctx.monitor.warn(`a proposta alterou arquivos de ${ctx.config.scope.join(', ')} (devia só escrever a spec)`);
    if (readySpec) return 'skipped';
  },
};
