/**
 * Regras de apresentação dos loops, sem React: ordem da lista, marcadores,
 * janelas de rolagem, resumos e textos. As telas e o modo headless só desenham o que sai daqui.
 */
import { stepLabel } from './config.js';
import { clock } from './format.js';
import type { LoopListItem } from './loops.js';
import type { ItemState, Iteration, Loop, LoopStage, LoopStatus } from './types.js';

export const LIST_ORDER: LoopStatus[] = [
  'running',
  'waiting',
  'paused',
  'interrupted',
  'failed',
  'pending',
  'draft',
  'done',
];

/** Em execução primeiro; depois parados no meio, os por começar e, por fim, os concluídos. Pastas com erro no fim. */
export function sortLoops(items: LoopListItem[]): LoopListItem[] {
  const weight = (item: LoopListItem) => (item.status ? LIST_ORDER.indexOf(item.status) : LIST_ORDER.length);
  return [...items].sort((a, b) => weight(a) - weight(b) || a.name.localeCompare(b.name));
}

export const STATUS_LABEL: Record<LoopStatus, string> = {
  draft: 'rascunho',
  pending: 'pendente',
  running: 'executando',
  waiting: 'aguardando',
  paused: 'pausado',
  failed: 'falhou',
  interrupted: 'interrompido',
  done: 'concluído',
};

export const STATUS_ICON: Record<LoopStatus, string> = {
  draft: '✎',
  pending: '○',
  running: '▶',
  waiting: '⚑',
  paused: '⏸',
  failed: '✖',
  interrupted: '■',
  done: '✔',
};

export const STATUS_COLOR: Record<LoopStatus, string | undefined> = {
  draft: 'gray',
  pending: undefined,
  running: 'cyan',
  waiting: 'magenta',
  paused: 'yellow',
  failed: 'red',
  interrupted: 'yellow',
  done: 'green',
};

export const STATE_MARK: Record<ItemState, string> = {
  ok: '✔',
  failed: '✖',
  skipped: '–',
  running: '▶',
  pending: '·',
  warn: '!',
};

export const STATE_COLOR: Record<ItemState, string | undefined> = {
  ok: 'green',
  failed: 'red',
  skipped: 'gray',
  running: 'cyan',
  pending: 'gray',
  warn: 'yellow',
};

export type StageSituation = 'delivered' | 'inProgress' | 'failed' | 'pending';

/** Onde a etapa está: entregue, em andamento (iteração aberta nela), falhou na última tentativa ou falta. */
export function stageSituation(loop: Loop, stage: LoopStage, status: LoopStatus): StageSituation {
  if (stage.status === 'delivered') return 'delivered';
  if (loop.iteration?.stage !== stage.number) return 'pending';
  return status === 'failed' ? 'failed' : 'inProgress';
}

export const STAGE_MARK: Record<StageSituation, string> = {
  delivered: '✔',
  inProgress: '▶',
  failed: '✖',
  pending: '·',
};
export const STAGE_COLOR: Record<StageSituation, string | undefined> = {
  delivered: 'green',
  inProgress: 'cyan',
  failed: 'red',
  pending: 'gray',
};

export interface PhaseProgress {
  name: string;
  delivered: number;
  total: number;
}

export function phaseProgress(stages: LoopStage[]): PhaseProgress[] {
  const phases: PhaseProgress[] = [];
  for (const stage of stages) {
    let phase = phases.find((p) => p.name === stage.phase);
    if (!phase) {
      phase = { name: stage.phase, delivered: 0, total: 0 };
      phases.push(phase);
    }
    phase.total++;
    if (stage.status === 'delivered') phase.delivered++;
  }
  return phases;
}

/** "Fundamentos 3/3 · Dados 1/4": a lateral recolhida dos terminais estreitos. */
export const phaseSummary = (stages: LoopStage[]) =>
  phaseProgress(stages)
    .map((phase) => `${phase.name} ${phase.delivered}/${phase.total}`)
    .join(' · ');

/** Janela de `height` itens em torno de `focus`, sem passar das pontas. `end` é exclusivo. */
export function scrollWindow(total: number, focus: number, height: number): { start: number; end: number } {
  if (total <= height) return { start: 0, end: total };
  const start = Math.min(Math.max(0, focus - Math.floor(height / 2)), total - height);
  return { start, end: start + height };
}

export type SidebarLine =
  | { kind: 'phase'; name: string; delivered: number; total: number }
  | { kind: 'stage'; stage: LoopStage; situation: StageSituation };

/** As fases e as etapas da lateral, em ordem; `focus` é o índice da linha da etapa em andamento ou da próxima. */
export function sidebarLines(
  loop: Loop,
  status: LoopStatus,
  stages = loop.stages,
): { lines: SidebarLine[]; focus: number } {
  const lines: SidebarLine[] = [];
  const progress = phaseProgress(stages);
  let focus = -1;
  const target = loop.iteration?.stage ?? stages.find((stage) => stage.status !== 'delivered')?.number;
  let currentPhase: string | undefined;
  for (const stage of stages) {
    if (stage.phase !== currentPhase) {
      currentPhase = stage.phase;
      const p = progress.find((phase) => phase.name === stage.phase);
      lines.push({ kind: 'phase', name: stage.phase, delivered: p?.delivered ?? 0, total: p?.total ?? 0 });
    }
    if (stage.number === target) focus = lines.length;
    lines.push({ kind: 'stage', stage, situation: stageSituation(loop, stage, status) });
  }
  return { lines, focus: Math.max(0, focus) };
}

/** Tempo total que cresce em tempo real enquanto o vigia vive. */
export function liveTime(
  totalMs: number,
  accountedUntil: number | undefined,
  alive: boolean,
  now = Date.now(),
): number {
  if (!alive || !accountedUntil) return totalMs;
  return totalMs + Math.max(0, now - accountedUntil);
}

/** Passos concluídos (ok ou pulados) sobre o total da iteração. */
export function iterationProgress(iteration: Iteration): { done: number; total: number } {
  return {
    done: iteration.steps.filter((step) => step.state === 'ok' || step.state === 'skipped').length,
    total: iteration.steps.length,
  };
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
export function when(iso: string | undefined, now = Date.now()): string {
  if (!iso) return 'nunca';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  const min = Math.floor((now - ts) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

export interface StepAverage {
  id: string;
  label: string;
  averageMs: number;
  averageCost: number;
  samples: number;
}

/** Tempo e custo médios de cada passo nas etapas entregues pelo loop. */
export function stepAverages(stages: LoopStage[]): StepAverage[] {
  const sums = new Map<string, { t: number; c: number; n: number }>();
  for (const stage of stages) {
    for (const step of stage.steps ?? []) {
      const sum = sums.get(step.id) ?? { t: 0, c: 0, n: 0 };
      sum.t += step.durationMs;
      sum.c += step.cost;
      sum.n++;
      sums.set(step.id, sum);
    }
  }
  return [...sums].map(([id, sum]) => ({
    id,
    label: stepLabel(id),
    averageMs: sum.t / sum.n,
    averageCost: sum.c / sum.n,
    samples: sum.n,
  }));
}

// ─── eventos (.execucao/eventos.jsonl) ───────────────────────────────────────

export type LogFilter = 'all' | 'noOutput' | 'main';
export const FILTERS: LogFilter[] = ['all', 'noOutput', 'main'];
export const FILTER_LABEL: Record<LogFilter, string> = {
  all: 'tudo',
  noOutput: 'sem saída de comandos',
  main: 'só o principal',
};

export interface LoopEvent {
  ts?: string;
  type?: string;
  level?: string;
  text?: string;
  [key: string]: unknown;
}

export function parseEvents(lines: string[]): LoopEvent[] {
  const events: LoopEvent[] = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as LoopEvent);
    } catch {
      // linha cortada ou corrompida
    }
  }
  return events;
}

/** As linhas de log, com hora e nível, no filtro escolhido. */
export function logLines(events: LoopEvent[], filter: LogFilter): string[] {
  const hidden = filter === 'all' ? [] : filter === 'noOutput' ? ['output'] : ['output', 'command', 'claude'];
  return events
    .filter((event) => event.type === 'log' && !hidden.includes(String(event.level)))
    .map((event) => {
      const mark = event.level === 'output' ? '  ' : `${String(event.level).padEnd(7)} `;
      return `${event.ts ? clock(Date.parse(event.ts)) : '--:--:--'} ${mark}${event.text ?? ''}`;
    });
}

export interface RecordedFailure {
  ts: string;
  step?: string;
  error: string;
  report?: string;
}

export function failuresFromEvents(events: LoopEvent[], max = 10): RecordedFailure[] {
  return events
    .filter((event) => event.type === 'failure')
    .slice(-max)
    .reverse()
    .map((event) => ({
      ts: String(event.ts ?? ''),
      step: typeof event.step === 'string' ? event.step : undefined,
      error: String(event.error ?? ''),
      report: typeof event.report === 'string' ? event.report : undefined,
    }));
}

// ─── ações ───────────────────────────────────────────────────────────────────

export interface Action {
  key: string;
  label: string;
}

/** As ações válidas para o status do loop (as mesmas na lista e na tela do loop). */
export function statusActions(status: LoopStatus, options: { divergent: boolean; pauseRequested: boolean }): Action[] {
  const reapprove = options.divergent
    ? [
        { key: 'a', label: 'aprovar o plano de novo' },
        { key: 'e', label: 'editar plano' },
      ]
    : [];
  switch (status) {
    case 'draft':
      return [
        { key: 'a', label: 'aprovar' },
        { key: 'e', label: 'editar plano' },
        { key: 'D', label: 'descartar' },
      ];
    case 'pending':
      return options.divergent ? reapprove : [{ key: 'i', label: 'iniciar' }];
    case 'waiting':
    case 'paused':
    case 'interrupted':
    case 'failed':
      return options.divergent ? reapprove : [{ key: 'i', label: 'continuar' }];
    case 'running':
      return [
        { key: 'p', label: options.pauseRequested ? 'cancelar a pausa' : 'pausar ao fim do passo' },
        { key: 'x', label: 'parar agora' },
      ];
    case 'done':
      return reapprove;
  }
}

/** `↻N` dos passos que tiveram recuperação; `resolved` diz se a última cumpriu a pós-condição. */
export function recoveryMark(step: {
  recoveries?: { resolved: boolean }[];
}): { text: string; resolved: boolean } | undefined {
  const n = step.recoveries?.length ?? 0;
  if (!n) return undefined;
  return { text: `↻${n}`, resolved: step.recoveries?.[n - 1]?.resolved ?? false };
}
