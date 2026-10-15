import { appendLine, writeJson } from './files.js';
import { oneLine } from './format.js';
import type { LoopPaths } from './loops.js';
import type {
  Activity,
  ItemState,
  IterationStep,
  Live,
  LiveItem,
  LogLevel,
  LogLine,
  Loop,
  SessionSummary,
  Totals,
} from './types.js';

export const MAX_ACTIVITIES = 60;
export const MAX_SESSIONS = 30;
export const MAX_LOGS_IN_MEMORY = 200;
const MAX_ITEMS = 40;
const MAX_LOG_TEXT = 500;

export interface LiveItemHandle {
  ok(detail?: string): void;
  failed(detail?: string): void;
  skipped(detail?: string): void;
  warn(detail?: string): void;
  running(detail?: string): void;
  detail(detail: string): void;
}

type CountableTotal = Exclude<keyof Totals, 'durationMs' | 'cost'>;

const memoryMb = () => Math.round(process.memoryUsage().rss / 1024 / 1024);

/**
 * O que a iteração conta para fora. Três destinos, todos em arquivo, porque a
 * tela roda noutro processo (e pode nem estar aberta):
 *
 * - eventos.jsonl: tudo, em append (log, sessões, verificações, commits, falhas);
 * - agora.json: o retrato do momento (passo, itens, ações do Claude), sobrescrito
 *   no máximo a cada `intervalMs`;
 * - loop.json: os totais acumulados, gravados a cada sessão, contagem e relógio.
 *
 * Em memória fica só o que tem limite: as últimas atividades, sessões e linhas de log.
 */
export class Monitor {
  readonly live: Live;
  readonly logs: LogLine[] = [];
  private pendingWrite?: NodeJS.Timeout;
  private clock?: NodeJS.Timeout;

  constructor(
    private readonly paths: LoopPaths,
    private readonly state: { loop: Loop },
    private readonly saveLoop: () => void,
    private readonly intervalMs = 500,
  ) {
    this.live = {
      pid: process.pid,
      updatedAt: Date.now(),
      accountedUntil: Date.now(),
      items: [],
      activities: [],
      sessions: [],
    };
  }

  private get loop() {
    return this.state.loop;
  }

  private currentStep(): IterationStep | undefined {
    const iteration = this.loop.iteration;
    return iteration ? iteration.steps[iteration.currentStep] : undefined;
  }

  // ─── eventos e log ───────────────────────────────────────────────────────

  event(type: string, data: Record<string, unknown> = {}) {
    const iteration = this.loop.iteration;
    appendLine(
      this.paths.events,
      JSON.stringify({
        ts: new Date().toISOString(),
        type,
        pid: process.pid,
        iteration: iteration?.number,
        stage: iteration?.stage,
        step: iteration ? iteration.steps[iteration.currentStep]?.id : undefined,
        ...data,
      }),
    );
  }

  log(level: LogLevel, text: string) {
    const brief = text.length > MAX_LOG_TEXT ? `${text.slice(0, MAX_LOG_TEXT - 1)}…` : text;
    this.logs.push({ ts: Date.now(), level, text: brief });
    if (this.logs.length > MAX_LOGS_IN_MEMORY) this.logs.shift();
    this.event('log', { level, text: brief });
  }

  warn(text: string) {
    this.live.warning = oneLine(text, 300);
    this.log('warn', text);
    this.writeLive();
  }

  waiting(text: string | undefined) {
    this.live.waiting = text;
    if (text) this.log('warn', text);
    this.writeLive();
  }

  // ─── retrato ao vivo ─────────────────────────────────────────────────────

  setIteration(data: Pick<Live, 'iteration' | 'stage' | 'change' | 'title'>) {
    Object.assign(this.live, data);
    this.writeLive();
  }

  startStep(index: number) {
    this.live.step = index;
    this.live.stepSince = Date.now();
    this.live.items = [];
    this.live.activities = [];
    this.live.warning = undefined;
    this.live.tasks = undefined;
    this.writeLive(true);
  }

  item(id: string, label: string, state: ItemState = 'running', detail?: string): LiveItemHandle {
    const existing = this.live.items.find((i) => i.id === id);
    const item: LiveItem = existing ?? { id, label, state };
    Object.assign(item, { label, state, detail, start: state === 'running' ? Date.now() : item.start });
    if (!existing) {
      this.live.items.push(item);
      if (this.live.items.length > MAX_ITEMS) this.live.items.shift();
    }
    this.writeLive();
    const change = (next: ItemState) => (detail?: string) => {
      item.state = next;
      if (detail !== undefined) item.detail = detail;
      if (next === 'running') item.start = Date.now();
      else item.end = Date.now();
      this.writeLive();
    };
    return {
      ok: change('ok'),
      failed: change('failed'),
      skipped: change('skipped'),
      warn: change('warn'),
      running: change('running'),
      detail: (text) => {
        item.detail = text;
        this.writeLive();
      },
    };
  }

  tasks(done: number, total: number) {
    this.live.tasks = { done, total };
    this.writeLive();
  }

  activity(activity: Activity) {
    this.live.activities.push(activity);
    if (this.live.activities.length > MAX_ACTIVITIES) this.live.activities.shift();
    this.writeLive();
  }

  startSession(label: string) {
    this.live.currentSession = label;
    this.live.activities = [];
    this.writeLive();
  }

  /** Cada tentativa de sessão soma custo, turnos e uma sessão ao loop e ao passo atual. */
  recordSession(session: SessionSummary) {
    this.live.currentSession = undefined;
    this.live.sessions.push(session);
    if (this.live.sessions.length > MAX_SESSIONS) this.live.sessions.shift();
    const totals = this.loop.totals;
    totals.cost += session.cost;
    totals.turns += session.turns;
    totals.claudeSessions++;
    const step = this.currentStep();
    if (step) step.cost += session.cost;
    this.event('claude_session', { ...session });
    this.log(
      session.ok ? 'ok' : 'error',
      `sessão ${session.label}: ${session.ok ? 'concluída' : `falhou (${session.error})`} · ${session.turns} turnos · US$ ${session.cost.toFixed(2)}`,
    );
    this.saveLoop();
    this.writeLive();
  }

  /**
   * Sessão que roda em paralelo ao passo atual: soma custo e turnos ao loop, mas
   * não mexe na sessão nem no custo do passo que está na tela.
   */
  recordParallelSession(session: SessionSummary) {
    const totals = this.loop.totals;
    totals.cost += session.cost;
    totals.turns += session.turns;
    totals.claudeSessions++;
    this.event('claude_session', { ...session, parallel: true });
    this.log(
      session.ok ? 'ok' : 'error',
      `sessão ${session.label} (em paralelo): ${session.ok ? 'concluída' : `falhou (${session.error})`} · ${session.turns} turnos · US$ ${session.cost.toFixed(2)}`,
    );
    this.saveLoop();
  }

  parallel(text: string | undefined) {
    this.live.parallel = text;
    this.writeLive();
  }

  count(total: CountableTotal, n = 1) {
    this.loop.totals[total] += n;
    this.saveLoop();
  }

  // ─── tempo ───────────────────────────────────────────────────────────────

  /** Soma ao loop (e ao passo atual) o tempo desde a última contagem. */
  accountTime() {
    const now = Date.now();
    const delta = Math.max(0, now - this.live.accountedUntil);
    this.live.accountedUntil = now;
    this.loop.totals.durationMs += delta;
    const step = this.currentStep();
    if (step) step.durationMs += delta;
    this.saveLoop();
    this.writeLive();
  }

  /** Grava o tempo periodicamente: um crash perde no máximo `intervalMs`. */
  startClock(intervalMs = 60_000) {
    this.live.accountedUntil = Date.now();
    this.clock = setInterval(() => this.accountTime(), intervalMs);
    this.clock.unref();
  }

  stopClock() {
    if (this.clock) clearInterval(this.clock);
    this.clock = undefined;
  }

  // ─── gravação ────────────────────────────────────────────────────────────

  writeLive(now = false) {
    if (now) return this.writeNow();
    if (this.pendingWrite) return;
    this.pendingWrite = setTimeout(() => this.writeNow(), this.intervalMs);
    this.pendingWrite.unref();
  }

  private writeNow() {
    if (this.pendingWrite) clearTimeout(this.pendingWrite);
    this.pendingWrite = undefined;
    this.live.updatedAt = Date.now();
    this.live.memoryMb = memoryMb();
    try {
      writeJson(this.paths.live, this.live);
    } catch {
      // o retrato ao vivo é só para a tela
    }
  }

  /** Grava tudo o que está pendente (antes de sair). */
  close() {
    this.stopClock();
    this.writeNow();
  }
}
