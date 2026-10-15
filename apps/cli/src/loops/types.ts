/** Versão do formato do loop.json que este CLI entende. */
export const LOOP_FORMAT = 1;

/**
 * - `draft`: plano gerado, ainda não aprovado;
 * - `pending`: aprovado, nunca rodou;
 * - `running`: com vigia vivo (sem vigia, vale como `interrupted`);
 * - `waiting`: precisa de uma pessoa (`lastRun.whatToDo` diz o quê);
 * - `paused`, `failed`, `interrupted`: parado no meio, continua do passo em que parou;
 * - `done`: todas as etapas entregues.
 */
export type LoopStatus = 'draft' | 'pending' | 'running' | 'waiting' | 'paused' | 'failed' | 'interrupted' | 'done';

export type ItemState = 'pending' | 'running' | 'ok' | 'failed' | 'warn' | 'skipped';

export type StepId =
  'briefing' | 'propose' | 'baseline' | 'commitProposal' | 'apply' | 'verifyChange' | 'archive' | 'commitDelivery';

/** Um comando de verificação (build, análise, testes), rodado sem shell. */
export interface Check {
  id: string;
  label: string;
  /** Comando e argumentos: `["npm", "run", "test"]`. */
  command: string[];
  /** Pasta de trabalho, relativa à raiz do repositório. */
  dir: string;
}

export interface Limits {
  /** Iterações (etapas entregues) por execução do vigia. */
  iterationsPerRun: number;
  /** Correções pedidas ao Claude quando uma verificação falha. */
  fixes: number;
  /** Rodadas extras de apply quando sobram tarefas abertas. */
  continuations: number;
  /** Execuções de um passo (a primeira e as reexecuções depois de recuperações). */
  attemptsPerStep: number;
  /** Sessões de recuperação por iteração. */
  recoveriesPerIteration: number;
  /** Tarefas por sessão do Claude no apply (um lote de grupos por sessão). */
  tasksPerSession: number;
  /** Crashes seguidos, sem entrega, que o vigia recupera antes de desistir. */
  restarts: number;
  /** Uma sessão do Claude é encerrada depois deste tempo. */
  sessionMin: number;
  /**
   * Uma sessão sem nenhum sinal do Claude por este tempo (fora de ferramenta em
   * execução) está parada: é encerrada e tentada de novo, sem esperar o sessionMin.
   */
  sessionIdleMin: number;
  /** Uma verificação é encerrada depois deste tempo. */
  commandMin: number;
}

export interface LoopConfig {
  /** Modelo do Claude (vazio = padrão do Claude Code). */
  model?: string;
  /** Pastas que entram nos commits do loop (além dos arquivos OpenSpec da change). */
  scope: string[];
  /** Prefixo do commit da entrega: `feat(backend)`. */
  commitPrefix: string;
  /** Comandos que precisam estar no PATH (além de claude, openspec e git). */
  requiredCommands: string[];
  checks: Check[];
  /** Ferramentas extras proibidas ao Claude: `Bash(npx prisma migrate reset:*)`. */
  forbiddenTools: string[];
  /** Passos de cada iteração, em ordem. */
  steps: string[];
  /** Só o que difere do padrão. */
  limits: Partial<Limits>;
}

export interface EffectiveConfig extends Omit<LoopConfig, 'limits'> {
  limits: Limits;
}

export interface StepSummary {
  id: string;
  durationMs: number;
  cost: number;
  attempts: number;
}

export interface LoopStage {
  number: number;
  phase: string;
  title: string;
  /** Nome da change OpenSpec: `<loop>-NN-<assunto>`, ou o de uma spec pronta. */
  change: string;
  /** A change já existia quando o loop foi criado: o loop a aplica sem propor. */
  readySpec?: boolean;
  status: 'pending' | 'delivered';
  iteration?: number;
  commit?: string;
  durationMs?: number;
  cost?: number;
  deliveredAt?: string;
  /** Tempo e custo de cada passo da iteração que entregou a etapa. */
  steps?: StepSummary[];
  /** Proposta escrita em paralelo durante a etapa anterior: o passo propose só a revisa. */
  early?: EarlyProposal;
}

export interface EarlyProposal {
  title: string;
  comparison: string;
  /** HEAD quando a proposta começou: o diff até a entrega mostra o que ela não viu. */
  base: string;
  commit: string;
  at: string;
}

/** Uma sessão de recuperação aberta depois da falha de um passo. */
export interface RecoveryRecord {
  number: number;
  error: string;
  signature: string;
  cause?: string;
  whatItDid?: string;
  /** Pela pós-condição do passo, não pela resposta do agente. */
  resolved: boolean;
  /** A proteção recusou a correção (desligava verificações). */
  refused?: string[];
  needsHuman?: boolean;
  cost: number;
  at: string;
}

export interface IterationStep {
  id: string;
  state: ItemState;
  durationMs: number;
  cost: number;
  attempts: number;
  detail?: string;
  recoveries?: RecoveryRecord[];
}

export interface Briefing {
  title: string;
  comparison: string;
  description: string;
}

export interface Iteration {
  number: number;
  /** Número da etapa do plano. */
  stage: number;
  briefing?: Briefing;
  startCommit: string;
  startedAt: string;
  /** Índice do primeiro passo ainda não concluído. */
  currentStep: number;
  /** Change que a proposta antecipada está escrevendo: só essa pasta pode ser apagada como sobra. */
  anticipating?: string;
  steps: IterationStep[];
}

export interface Totals {
  durationMs: number;
  cost: number;
  runs: number;
  iterationsStarted: number;
  iterationsDelivered: number;
  claudeSessions: number;
  turns: number;
  checks: number;
  fixes: number;
  recoveries: number;
  recoveriesResolved: number;
  failures: number;
  restarts: number;
  commits: number;
}

export interface LastRun {
  start: string;
  end?: string;
  outcome?: LoopStatus;
  reason?: string;
  /** Em `waiting`: o que a pessoa precisa fazer antes de continuar. */
  whatToDo?: string;
  /** Relatório da última falha, relativo à raiz. */
  report?: string;
}

export interface Loop {
  format: number;
  name: string;
  title: string;
  createdAt: string;
  status: LoopStatus;
  config: LoopConfig;
  stages: LoopStage[];
  iteration: Iteration | null;
  totals: Totals;
  lastRun?: LastRun;
}

// ─── retrato ao vivo (.execucao/agora.json) ──────────────────────────────────

export interface Activity {
  ts: number;
  kind: 'tool' | 'text';
  text: string;
}

export interface LiveItem {
  id: string;
  label: string;
  state: ItemState;
  detail?: string;
  start?: number;
  end?: number;
}

export interface SessionSummary {
  label: string;
  attempt: number;
  ok: boolean;
  cost: number;
  turns: number;
  durationMs: number;
  error?: string;
  file: string;
  end: number;
}

export interface Live {
  pid: number;
  updatedAt: number;
  /** Até quando o tempo já foi somado ao loop.json. */
  accountedUntil: number;
  iteration?: number;
  stage?: number;
  change?: string;
  title?: string;
  step?: number;
  stepSince?: number;
  items: LiveItem[];
  activities: Activity[];
  sessions: SessionSummary[];
  currentSession?: string;
  tasks?: { done: number; total: number };
  warning?: string;
  waiting?: string;
  /** O que roda em paralelo ao passo atual (a proposta antecipada da próxima etapa). */
  parallel?: string;
  memoryMb?: number;
}

export type LogLevel = 'info' | 'ok' | 'warn' | 'error' | 'step' | 'claude' | 'command' | 'output';

export interface LogLine {
  ts: number;
  level: LogLevel;
  text: string;
}

/** Pedidos do CLI para o loop em execução (.execucao/controle.json). */
export interface Control {
  pause: boolean;
  requestedAt?: string;
}
