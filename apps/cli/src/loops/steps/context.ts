import type { LoopPaths } from '../loops.js';
import type { Monitor } from '../monitor.js';
import type { Plan } from '../plan.js';
import type { EffectiveConfig, Iteration, Loop, LoopStage, StepId } from '../types.js';
import type { EarlyProposalRun } from './early.js';

/** Tudo o que um passo precisa. O que passa de um passo para outro fica no loop.json, nunca só em memória. */
export interface IterationContext {
  paths: LoopPaths;
  state: { loop: Loop };
  config: EffectiveConfig;
  plan: Plan;
  stage: LoopStage;
  /** Pasta da iteração em .execucao/ (streams do Claude, logs, relatórios). */
  dir: string;
  monitor: Monitor;
  save: () => void;
  pauseRequested: () => boolean;
  signal: AbortSignal;
  /** Prompt de sistema de todas as sessões: regras gerais + regras do plano. */
  system: string;
  /** Ferramentas proibidas ao Claude: gerais + motor + loop.json + extras do loop. */
  forbidden: string[];
  /** Valores comuns dos prompts: LOOP, PLANO, ESCOPO, ESCOPO_ARGS, VERIFICACOES, NOME, NUMERO, TOTAL, FASE, TITULO. */
  values: Record<string, string | number>;
  /** Alterações fora do escopo quando a execução começou (para avisar só das novas). */
  outsideBefore: string[];
  /** A proposta da próxima etapa, escrita em paralelo ao apply desta. */
  early?: EarlyProposalRun;
}

export const iterationOf = (ctx: IterationContext): Iteration => {
  const iteration = ctx.state.loop.iteration;
  if (!iteration) throw new Error('nenhuma iteração em andamento');
  return iteration;
};

export interface Step {
  id: StepId;
  /** 'skipped' quando o passo não se aplica (ex.: loop sem verificações). */
  execute: (ctx: IterationContext) => Promise<void | 'skipped'>;
  /**
   * O que falta para o resultado do passo existir; [] = cumprido. É o motor que
   * decide se uma recuperação resolveu, por aqui, nunca pela resposta do agente.
   */
  postcondition: (ctx: IterationContext) => Promise<string[]>;
  /** A pós-condição em texto, para o prompt da recuperação. */
  success: string;
}

export interface FailureDetails {
  file?: string;
  tail?: string[];
}

/** Falha de passo, com o que ajuda a entender o problema depois. */
export class StepFailure extends Error {
  constructor(
    message: string,
    readonly details: FailureDetails = {},
  ) {
    super(message);
  }
}

/** A solução depende de uma pessoa: o loop para em `waiting` com o que fazer. */
export class NeedsHuman extends StepFailure {
  constructor(
    message: string,
    readonly whatToDo: string,
    details: FailureDetails = {},
  ) {
    super(message, details);
  }
}

/** O usuário pediu pausa no meio de um passo longo (entre lotes do apply). */
export class PauseRequested extends Error {
  constructor() {
    super('pausa pedida');
  }
}

/** A iteração foi cancelada (parar agora). */
export class Cancelled extends Error {
  constructor() {
    super('cancelado');
  }
}
