import path from 'node:path';
import type { Command, CommandContext, CommandResult } from '../../core/command.js';
import { effectiveConfig, loopsRoot, stepLabel } from '../../loops/config.js';
import {
  approve,
  discardDraft,
  preflight,
  readControl,
  requestPause,
  startLoop,
  stopNow,
} from '../../loops/control.js';
import { fileSize, readFrom, readJson, readTail } from '../../loops/files.js';
import { errorMessage, longDuration, money } from '../../loops/format.js';
import { liveLock } from '../../loops/lock.js';
import {
  deliveredStages,
  type LoopListItem,
  listLoops,
  loopPaths,
  nextStage,
  planDivergences,
  readLoop,
  readLoopPlan,
  specsForNewLoop,
  validateLoopName,
} from '../../loops/loops.js';
import { planLoop } from '../../loops/planner.js';
import {
  FILTERS,
  type LogFilter,
  logLines,
  parseEvents,
  sortLoops,
  STATUS_ICON,
  STATUS_LABEL,
  when,
} from '../../loops/presentation.js';
import { sleep } from '../../loops/process.js';
import type { Live, LoopStatus } from '../../loops/types.js';

const GROUP = 'Desenvolvimento';

type Statuses = LoopStatus[] | 'any';

/**
 * O loop do comando: `--loop=<nome>` ou, sem ele, uma escolha entre os loops nos status aceitos.
 * Com um candidato só, é ele; no headless com `--yes`, só vale um candidato.
 */
async function chooseLoop(ctx: CommandContext, accepted: Statuses, verb: string): Promise<LoopListItem | string> {
  const items = sortLoops(listLoops());
  const given = ctx.options.loop?.trim();
  if (given && given !== 'true') {
    const item = items.find((candidate) => candidate.name === given);
    return (
      item ??
      `loop "${given}" não encontrado em openspec/loops (${items.map((i) => i.name).join(', ') || 'nenhum loop ainda'})`
    );
  }
  const candidates = items.filter((item) => accepted === 'any' || (item.status && accepted.includes(item.status)));
  if (!candidates.length)
    return items.length ? `nenhum loop pode ${verb} agora` : 'nenhum loop ainda: crie um com `jaja loops:new`';
  if (candidates.length === 1 && candidates[0]) return candidates[0];
  const [choice] = await ctx.pick(
    `Qual loop ${verb}?`,
    candidates.map((item) => ({
      id: item.name,
      label: item.name,
      description: item.status ? `${STATUS_ICON[item.status]} ${STATUS_LABEL[item.status]}` : item.error,
    })),
    { defaults: [], required: true },
  );
  const item = candidates.find((candidate) => candidate.name === choice);
  return item ?? 'nenhum loop escolhido (use --loop=<nome>)';
}

const fail = (summary: string): CommandResult => ({ status: 'error', summary });

function reportItem(ctx: CommandContext, item: LoopListItem) {
  if (!item.loop || !item.status) {
    ctx.report.error(`${item.name}: ${item.error}`);
    return;
  }
  const { loop, status } = item;
  const total = status === 'draft' ? '—' : `${deliveredStages(loop)}/${loop.stages.length}`;
  const stage = loop.iteration ? loop.stages.find((s) => s.number === loop.iteration?.stage) : undefined;
  const step = loop.iteration?.steps[loop.iteration.currentStep];
  const where = stage ? ` · etapa ${stage.number}${step ? ` (${stepLabel(step.id).toLowerCase()})` : ''}` : '';
  const line = `${item.name.padEnd(24)} ${`${STATUS_ICON[status]} ${STATUS_LABEL[status]}`.padEnd(15)} ${total.padStart(6)} etapas · ${longDuration(loop.totals.durationMs)} · ${money(loop.totals.cost)} · ${loop.totals.runs} exec. · ${when(loop.lastRun?.end ?? loop.lastRun?.start)}${where}`;
  if (status === 'failed') ctx.report.error(line);
  else if (status === 'waiting' || status === 'interrupted' || status === 'paused') ctx.report.warn(line);
  else if (status === 'done') ctx.report.success(line);
  else ctx.report.info(line);
  if (status === 'waiting' && loop.lastRun?.whatToDo) ctx.report.detail(`o que fazer: ${loop.lastRun.whatToDo}`);
}

export const loopsCommand: Command = {
  id: 'loops',
  title: 'Loops de desenvolvimento',
  description: 'Entregam um objetivo em etapas, uma change OpenSpec por etapa, em segundo plano com o Claude',
  group: GROUP,
  kind: 'screen',
  icon: '🔁',
  keywords: ['loop', 'openspec', 'claude', 'agente', 'automatico', 'specs', 'changes'],
  async run(ctx) {
    const items = sortLoops(listLoops());
    if (!items.length) {
      ctx.report.info('Nenhum loop ainda. Crie um com `jaja loops:new` (ou pela paleta).');
      return { status: 'ok', summary: 'Nenhum loop em openspec/loops' };
    }
    for (const item of items) reportItem(ctx, item);
    const running = items.filter((item) => item.status === 'running').length;
    const waiting = items.filter((item) => item.status === 'waiting').length;
    return {
      status: waiting ? 'warn' : 'ok',
      summary: `${items.length} loop(s)${running ? ` · ${running} executando` : ''}${waiting ? ` · ${waiting} aguardando uma pessoa` : ''}`,
    };
  },
  children: [],
};

export const loopsNew: Command = {
  id: 'loops:new',
  title: 'Novo loop',
  description: 'Planeja um loop com o Claude (só leitura), a partir de um objetivo ou de specs já criadas',
  group: GROUP,
  kind: 'screen',
  keywords: ['criar', 'planejar', 'plano', 'objetivo'],
  async run(ctx) {
    const name = (
      ctx.options.nome ?? (await ctx.ask('Nome do loop (kebab-case, vira o prefixo das changes)', ''))
    ).trim();
    const invalid = validateLoopName(name);
    if (invalid) return fail(`nome inválido: ${invalid}`);
    const specs = (ctx.options.specs ?? '')
      .split(',')
      .map((spec) => spec.trim())
      .filter(Boolean);
    if (specs.length) {
      const available = specsForNewLoop();
      for (const spec of specs) {
        const found = available.find((candidate) => candidate.name === spec);
        if (!found)
          return fail(`a spec "${spec}" não está pendente em openspec/changes (precisa de proposal.md ou tasks.md)`);
        if (found.inLoop) return fail(`a spec "${spec}" já é uma etapa do loop ${found.inLoop}`);
      }
    }
    const goal = specs.length
      ? ''
      : (ctx.options.objetivo ?? (await ctx.ask('Objetivo do loop (o que ele entrega)', ''))).trim();
    if (!specs.length && goal.length < 10) return fail('descreva o objetivo com --objetivo="…" (pelo menos uma frase)');
    if (ctx.dryRun) {
      ctx.report.info(
        specs.length
          ? `Planejaria o loop ${name} com as specs: ${specs.join(' → ')}`
          : `Planejaria o loop ${name} para: ${goal}`,
      );
      return { status: 'ok', summary: 'Dry-run: nada foi gravado' };
    }
    ctx.report.info(
      specs.length
        ? 'O Claude está preparando o plano e as verificações (só leitura)…'
        : 'O Claude está planejando as etapas (só leitura)…',
    );
    const result = await planLoop({
      name,
      goal,
      specs,
      model: ctx.options.modelo,
      signal: ctx.signal,
      onActivity: (activity) => ctx.report.detail(`${activity.kind === 'tool' ? '→' : '💬'} ${activity.text}`),
      onWait: (text) => text && ctx.report.warn(text),
      onLog: (text) => ctx.report.detail(text),
    });
    if (!result.ok)
      return result.cancelled
        ? { status: 'warn', summary: 'Planejamento cancelado; nada foi gravado' }
        : fail(result.error);
    const paths = loopPaths(name);
    ctx.report.success(
      `Rascunho gravado em ${path.relative(loopsRoot(), paths.plan)} (${result.plan.phases.reduce((n, phase) => n + phase.stages.length, 0)} etapas)`,
    );
    for (const warning of result.warnings) ctx.report.warn(warning);
    ctx.report.detail(
      `Revise o plano.md e aprove com \`jaja loops:approve --loop=${name}\` (ou \`a\` na tela do loop).`,
    );
    return { status: 'ok', summary: `Loop ${name} criado como rascunho · ${money(result.loop.totals.cost)}` };
  },
};

export const loopsStatus: Command = {
  id: 'loops:status',
  title: 'Estado de um loop',
  description: 'Etapas, iteração atual, passos, totais e o que fazer quando o loop aguarda uma pessoa',
  group: GROUP,
  keywords: ['status', 'progresso', 'detalhes'],
  async run(ctx) {
    const item = await chooseLoop(ctx, 'any', 'ver');
    if (typeof item === 'string') return fail(item);
    if (!item.loop || !item.status) return fail(`${item.name}: ${item.error}`);
    const { loop, status } = item;
    const config = effectiveConfig(loop.config);
    ctx.report.title(
      `${loop.title} (${loop.name}) · ${STATUS_ICON[status]} ${STATUS_LABEL[status]}${item.watcher ? ` · vigia pid ${item.watcher}` : ''}`,
    );
    const live = item.watcher ? readJson<Live>(item.paths.live) : undefined;
    for (const stage of loop.stages) {
      const current = loop.iteration?.stage === stage.number;
      const mark = stage.status === 'delivered' ? '✔' : current ? '▶' : '·';
      const extra =
        stage.status === 'delivered'
          ? ` · ${stage.commit ? stage.commit.slice(0, 9) : 'fora do loop'}${stage.cost ? ` · ${money(stage.cost)}` : ''}`
          : '';
      ctx.report.detail(
        `${mark} ${String(stage.number).padStart(2, '0')} ${stage.title} · ${stage.change}${stage.readySpec ? ' (spec pronta)' : ''}${extra}`,
      );
    }
    if (loop.iteration) {
      ctx.report.info(
        `Iteração ${loop.iteration.number} · etapa ${loop.iteration.stage}${loop.iteration.briefing ? ` · ${loop.iteration.briefing.title}` : ''}`,
      );
      loop.iteration.steps.forEach((step, index) => {
        const recoveries = step.recoveries?.length ? ` · ↻${step.recoveries.length}` : '';
        ctx.report.detail(
          `${index === loop.iteration?.currentStep ? '▸' : ' '} ${index + 1}. ${stepLabel(step.id).padEnd(28)} ${step.state.padEnd(8)} ${longDuration(step.durationMs).padStart(7)}${step.cost ? ` · ${money(step.cost)}` : ''}${step.attempts > 1 ? ` · ×${step.attempts}` : ''}${recoveries}${step.detail ? ` · ${step.detail}` : ''}`,
        );
      });
    } else {
      const next = nextStage(loop);
      if (next) ctx.report.info(`Próxima etapa: ${next.number} · ${next.title} (${next.change})`);
    }
    if (live?.ok) {
      const now = live.value;
      if (now.waiting) ctx.report.warn(now.waiting);
      if (now.parallel) ctx.report.detail(`em paralelo: ${now.parallel}`);
      for (const liveItem of now.items.filter((i) => i.state === 'running'))
        ctx.report.detail(`▶ ${liveItem.label}${liveItem.detail ? ` · ${liveItem.detail}` : ''}`);
      const last = now.activities.at(-1);
      if (last) ctx.report.detail(`${last.kind === 'tool' ? '→' : '💬'} ${last.text}`);
    }
    try {
      const divergences = planDivergences(loop, readLoopPlan(item.paths));
      if (loop.status !== 'draft' && divergences.length) {
        ctx.report.warn('o plano.md mudou desde a aprovação: aprove de novo para continuar');
        for (const divergence of divergences.slice(0, 5)) ctx.report.detail(divergence);
      }
    } catch {
      ctx.report.warn('plano.md não encontrado');
    }
    const t = loop.totals;
    ctx.report.info(
      `Totais: ${longDuration(t.durationMs)} · ${money(t.cost)} · ${t.runs} exec. · ${t.iterationsDelivered} entregas · ${t.claudeSessions} sessões · ${t.checks} verificações · ${t.fixes} correções · ${t.recoveries} recuperações (${t.recoveriesResolved} resolvidas) · ${t.restarts} reinícios · ${t.commits} commits`,
    );
    ctx.report.detail(
      `Escopo: ${config.scope.join(', ') || '(nenhum)'} · commit ${config.commitPrefix}: … · ${config.checks.length} verificação(ões)`,
    );
    if (loop.lastRun?.reason && status !== 'running') {
      if (status === 'failed') ctx.report.error(loop.lastRun.reason);
      else ctx.report.warn(loop.lastRun.reason);
      if (loop.lastRun.whatToDo) ctx.report.warn(`O que fazer: ${loop.lastRun.whatToDo}`);
      if (loop.lastRun.report) ctx.report.detail(`relatório: ${loop.lastRun.report}`);
    }
    return {
      status: status === 'failed' ? 'error' : status === 'waiting' ? 'warn' : 'ok',
      summary: `${loop.name}: ${STATUS_LABEL[status]} · ${deliveredStages(loop)}/${loop.stages.length} etapas`,
    };
  },
};

export const loopsStart: Command = {
  id: 'loops:start',
  title: 'Iniciar ou continuar um loop',
  description: 'Confere plano, PATH e escopo e sobe o vigia em segundo plano (fechar o CLI não para o loop)',
  group: GROUP,
  keywords: ['iniciar', 'continuar', 'retomar', 'rodar', 'vigia'],
  async run(ctx) {
    const item = await chooseLoop(
      ctx,
      ['pending', 'waiting', 'paused', 'interrupted', 'failed'],
      'iniciar ou continuar',
    );
    if (typeof item === 'string') return fail(item);
    if (ctx.dryRun) {
      const check = preflight(item.name);
      for (const problem of check.problems) ctx.report.error(problem);
      for (const warning of check.warnings) ctx.report.warn(warning);
      return check.problems.length
        ? fail('O loop não pode começar agora')
        : { status: 'ok', summary: `Dry-run: o vigia de ${item.name} subiria` };
    }
    const result = await startLoop(item.name);
    for (const problem of result.problems) ctx.report.error(problem);
    for (const warning of result.warnings) ctx.report.warn(warning);
    if (result.problems.length) return fail(`O loop ${item.name} não começou`);
    ctx.report.detail(`Acompanhe com \`jaja loops\` (paleta) ou \`jaja loops:log --loop=${item.name} --seguir\`.`);
    return { status: 'ok', summary: `Vigia de ${item.name} rodando em segundo plano (pid ${result.pid})` };
  },
};

export const loopsPause: Command = {
  id: 'loops:pause',
  title: 'Pausar um loop',
  description: 'Pede a pausa ao fim do passo atual (--cancelar desfaz o pedido)',
  group: GROUP,
  keywords: ['pausar', 'pausa'],
  async run(ctx) {
    const item = await chooseLoop(ctx, ['running'], 'pausar');
    if (typeof item === 'string') return fail(item);
    const cancel = ctx.options.cancelar === 'true';
    if (!liveLock(item.paths.lock)) return { status: 'warn', summary: `${item.name} não está em execução` };
    if (ctx.dryRun)
      return { status: 'ok', summary: `Dry-run: ${cancel ? 'cancelaria a pausa' : 'pediria a pausa'} de ${item.name}` };
    requestPause(item.name, !cancel);
    return {
      status: 'ok',
      summary: cancel ? `Pausa de ${item.name} cancelada` : `${item.name} pausa ao fim do passo atual`,
    };
  },
};

export const loopsStop: Command = {
  id: 'loops:stop',
  title: 'Parar um loop agora',
  description: 'Encerra a iteração e os processos dela; o passo interrompido é retomado ao continuar',
  group: GROUP,
  keywords: ['parar', 'interromper', 'matar', 'stop'],
  async run(ctx) {
    const item = await chooseLoop(ctx, ['running'], 'parar');
    if (typeof item === 'string') return fail(item);
    if (ctx.dryRun) return { status: 'ok', summary: `Dry-run: pararia ${item.name}` };
    if (!(await ctx.confirm(`Parar o loop ${item.name} agora? O passo em andamento é retomado ao continuar.`, false)))
      return { status: 'warn', summary: 'Nada foi feito' };
    if (!stopNow(item.name)) return { status: 'warn', summary: `${item.name} não está em execução` };
    for (let attempt = 0; attempt < 60 && liveLock(item.paths.lock); attempt++) await sleep(500, ctx.signal);
    return liveLock(item.paths.lock)
      ? { status: 'warn', summary: `Pedido enviado; o vigia de ${item.name} ainda está encerrando` }
      : { status: 'ok', summary: `${item.name} parado; continue com \`jaja loops:start --loop=${item.name}\`` };
  },
};

export const loopsApprove: Command = {
  id: 'loops:approve',
  title: 'Aprovar o plano de um loop',
  description: 'Congela as etapas do plano.md no loop.json (rascunho ou plano editado depois de aprovado)',
  group: GROUP,
  keywords: ['aprovar', 'plano', 'rascunho'],
  async run(ctx) {
    const item = await chooseLoop(
      ctx,
      ['draft', 'pending', 'waiting', 'paused', 'interrupted', 'failed', 'done'],
      'aprovar',
    );
    if (typeof item === 'string') return fail(item);
    if (ctx.dryRun) return { status: 'ok', summary: `Dry-run: aprovaria o plano de ${item.name}` };
    const errors = approve(item.name);
    for (const error of errors) ctx.report.error(error);
    if (errors.length) return fail(`O plano de ${item.name} não foi aprovado`);
    const loop = readLoop(item.paths);
    return {
      status: 'ok',
      summary: `Plano de ${item.name} aprovado · ${loop.stages.length} etapas · inicie com \`jaja loops:start --loop=${item.name}\``,
    };
  },
};

export const loopsDiscard: Command = {
  id: 'loops:discard',
  title: 'Descartar um rascunho de loop',
  description: 'Apaga a pasta openspec/loops/<nome> de um loop ainda em rascunho',
  group: GROUP,
  keywords: ['descartar', 'apagar', 'rascunho'],
  async run(ctx) {
    const item = await chooseLoop(ctx, ['draft'], 'descartar');
    if (typeof item === 'string') return fail(item);
    if (ctx.dryRun) return { status: 'ok', summary: `Dry-run: apagaria openspec/loops/${item.name}` };
    if (
      !(await ctx.confirm(`Descartar o rascunho ${item.name}? A pasta openspec/loops/${item.name} é apagada.`, false))
    )
      return { status: 'warn', summary: 'Nada foi feito' };
    const error = discardDraft(item.name);
    return error ? fail(error) : { status: 'ok', summary: `Rascunho ${item.name} descartado` };
  },
};

export const loopsLog: Command = {
  id: 'loops:log',
  title: 'Log de um loop',
  description: 'Últimas linhas do eventos.jsonl (--seguir acompanha até o vigia parar; --filtro=all|noOutput|main)',
  group: GROUP,
  keywords: ['log', 'eventos', 'acompanhar', 'tail'],
  async run(ctx) {
    const item = await chooseLoop(ctx, 'any', 'acompanhar');
    if (typeof item === 'string') return fail(item);
    const filter: LogFilter = FILTERS.includes(ctx.options.filtro as LogFilter)
      ? (ctx.options.filtro as LogFilter)
      : 'noOutput';
    const count = Math.max(1, Number(ctx.options.linhas) || 40);
    let offset = fileSize(item.paths.events);
    const all = logLines(parseEvents(readTail(item.paths.events)), filter);
    for (const line of all.slice(-count)) ctx.report.detail(line);
    if (ctx.options.seguir !== 'true')
      return {
        status: 'ok',
        summary: `${item.name}: ${Math.min(count, all.length)} de ${all.length} linha(s) (${filter})`,
      };
    ctx.report.info('acompanhando o log até o vigia parar (Esc/Ctrl+C encerra só a leitura)');
    while (!ctx.signal.aborted) {
      await sleep(1000, ctx.signal);
      const read = readFrom(item.paths.events, offset);
      offset = read.offset;
      for (const line of logLines(parseEvents(read.lines), filter)) ctx.report.detail(line);
      if (!liveLock(item.paths.lock)) break;
    }
    try {
      const loop = readLoop(item.paths);
      const pause = readControl(item.paths).pause;
      return {
        status: loop.status === 'failed' ? 'error' : 'ok',
        summary: `${item.name}: ${STATUS_LABEL[loop.status]}${pause ? ' (pausa pedida)' : ''}`,
      };
    } catch (error) {
      return fail(errorMessage(error));
    }
  },
};

loopsCommand.children = [
  loopsNew,
  loopsStatus,
  loopsStart,
  loopsPause,
  loopsStop,
  loopsApprove,
  loopsDiscard,
  loopsLog,
];
