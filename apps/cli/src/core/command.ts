import type { ExecOptions, ExecResult } from './exec.js';
import type { ProjectInfo } from './project.js';

export type CommandStatus = 'ok' | 'warn' | 'error';

export interface CommandResult {
  status: CommandStatus;
  summary: string;
}

export type LogLevel = 'title' | 'info' | 'detail' | 'success' | 'warn' | 'error' | 'step';

export type StepStatus = 'pending' | 'running' | 'ok' | 'warn' | 'error' | 'skipped';

export interface LogEntry {
  level: LogLevel;
  message: string;
  /** Presente quando `level === 'step'`: mudança de estado de uma etapa de wizard. */
  step?: { id: string; label: string; status: StepStatus };
}

/** Destino das mensagens: a tela do Ink ou o console em modo headless. */
export interface Reporter {
  log(entry: LogEntry): void;
}

export interface AskOptions {
  /** Entrada mascarada (segredos): não ecoa o que é digitado. */
  secret?: boolean;
}

/** Item de uma lista de escolha (`pick`). */
export interface PickOption {
  id: string;
  label: string;
  description?: string;
}

export interface PickConfig {
  /** `true`: várias escolhas (checklist). `false` (padrão): uma só. */
  multi?: boolean;
  /** Ids marcados inicialmente; em modo headless (`--yes`) é a resposta. */
  defaults?: string[];
  /** Exige ao menos uma escolha (padrão em multi: true). */
  required?: boolean;
}

/** Origem das respostas a perguntas: a tela do Ink ou o stdin em modo headless. */
export interface Prompter {
  confirm(question: string, defaultValue: boolean): Promise<boolean>;
  ask(question: string, defaultValue: string, options?: AskOptions): Promise<string>;
  /** Escolha entre opções; devolve os ids escolhidos na ordem da lista. */
  pick(question: string, options: PickOption[], config: PickConfig): Promise<string[]>;
}

export interface ReportApi {
  title(message: string): void;
  info(message: string): void;
  detail(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Progresso de uma etapa de wizard (a UI desenha o checklist a partir disso). */
  step(id: string, label: string, status: StepStatus): void;
}

export type ExecFn = (command: string, args?: string[], options?: ExecOptions) => Promise<ExecResult>;

export interface CommandContext {
  project: ProjectInfo;
  /** `true` quando o usuário passou `--yes`: confirmações destrutivas são assumidas. */
  yes: boolean;
  /** `true` com `--dry-run`: comandos mostram o que fariam sem alterar nada. */
  dryRun: boolean;
  report: ReportApi;
  /** Executa um processo externo, transmitindo a saída para o `report` (salvo `quiet: true`). */
  exec: ExecFn;
  /** Pergunta sim/não. Com `--yes` devolve `defaultValue` sem perguntar. */
  confirm(question: string, defaultValue?: boolean): Promise<boolean>;
  /** Pergunta de texto. Com `--yes` devolve `defaultValue` sem perguntar. */
  ask(question: string, defaultValue: string, options?: AskOptions): Promise<string>;
  /** Escolha entre opções (uma ou várias). Com `--yes` devolve `config.defaults` sem perguntar. */
  pick(question: string, options: PickOption[], config?: PickConfig): Promise<string[]>;
  /** Opções livres da linha de comando (`--categorias=a,b`), para comandos rodarem sem perguntas. */
  options: Record<string, string>;
  /** Etapas escolhidas para um wizard (checklist na UI, `--steps`/`--all` no headless). `undefined` = padrões. */
  selection?: string[];
  signal: AbortSignal;
}

/** Uma etapa selecionável de um wizard. Roda como um comando, dentro do mesmo contexto. */
export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  /** Marcada por padrão na checklist e usada em modo headless sem `--steps`. */
  defaultSelected: boolean;
  /** Etapas que precisam rodar antes; são incluídas automaticamente quando esta é escolhida. */
  requires?: string[];
  /** Quando true, a falha desta etapa não impede as seguintes. */
  continueOnError?: boolean;
  /** Aviso mostrado na checklist para etapas destrutivas. */
  danger?: string;
  run(ctx: CommandContext): Promise<CommandResult>;
}

export type JourneyStatus = 'done' | 'pending' | 'attention' | 'unknown';

export interface JourneyDetection {
  status: JourneyStatus;
  /** Frase curta: o que existe ou o que falta. */
  detail?: string;
}

/** Agrupa passos de uma jornada na tela e nas seleções `@<id>` (ex.: `--steps @cicd`). */
export interface JourneyArea {
  id: string;
  label: string;
}

/**
 * Passo de uma jornada: como uma etapa de wizard, mas com `detect`, que descobre
 * (sem efeitos colaterais nem perguntas) se o passo já foi feito.
 */
export interface JourneyStep extends WizardStep {
  detect(ctx: CommandContext): Promise<JourneyDetection>;
  /** Faz parte da sequência "Publicar" (o que o CI/CD roda sozinho). */
  publish?: boolean;
  /** Id da área (`JourneyArea`) do passo. Passos de uma mesma área ficam juntos, em sequência. */
  area?: string;
}

/**
 * Um comando não conhece Ink. Ele só recebe o contexto e devolve um resultado,
 * o que permite rodá-lo na paleta, no terminal com flags ou em CI.
 */
export interface Command {
  id: string;
  title: string;
  description: string;
  group: string;
  keywords?: string[];
  /**
   * `action` (padrão): roda direto. `wizard`: mostra a checklist de `steps` e roda as escolhidas.
   * `menu`: abre a lista de `children`. `journey`: lista ordenada de passos com estado detectado.
   */
  kind?: 'action' | 'wizard' | 'menu' | 'journey';
  steps?: WizardStep[];
  /** Áreas de uma jornada, na ordem de exibição. */
  areas?: JourneyArea[];
  children?: Command[];
  /** Ícone opcional exibido no menu inicial. */
  icon?: string;
  run(ctx: CommandContext): Promise<CommandResult>;
}
