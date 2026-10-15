import { EXIT } from './config.js';
import type { LoopStatus } from './types.js';

export type Next =
  | { action: 'next' }
  | { action: 'recover'; waitMs: number; reason: string }
  | { action: 'stop'; status: LoopStatus; reason: string };

/** Esperas antes de cada recuperação seguida (a última se repete). */
export const RECOVERY_WAITS_MS = [10_000, 60_000, 180_000, 300_000];

export const restartWait = (consecutiveCrashes: number) =>
  RECOVERY_WAITS_MS[Math.min(consecutiveCrashes, RECOVERY_WAITS_MS.length - 1)] as number;

/** Sinais que significam "alguém mandou parar", não crash. */
const STOP_SIGNALS = new Set(['SIGINT', 'SIGTERM', 'SIGHUP']);

/**
 * O que o vigia faz quando o processo da iteração termina. Parada intencional
 * (conclusão, pausa, falha registrada, interrupção) não é repetida: daria o mesmo
 * resultado e gastaria tokens à toa. Todo o resto é crash e é recuperado.
 */
export function decideAfterExit(
  code: number | null,
  signal: string | null,
  consecutiveCrashes: number,
  maxRestarts: number,
): Next {
  if (signal && STOP_SIGNALS.has(signal))
    return { action: 'stop', status: 'interrupted', reason: `interrompido (${signal})` };
  switch (code) {
    case EXIT.delivered:
      return { action: 'next' };
    case EXIT.done:
      return { action: 'stop', status: 'done', reason: 'todas as etapas do plano foram entregues' };
    case EXIT.paused:
      return { action: 'stop', status: 'paused', reason: 'pausado a pedido' };
    case EXIT.failed:
      return { action: 'stop', status: 'failed', reason: 'falha registrada pela iteração' };
    case EXIT.waiting:
      return { action: 'stop', status: 'waiting', reason: 'aguardando uma pessoa' };
    case EXIT.interrupted:
      return { action: 'stop', status: 'interrupted', reason: 'interrompido' };
  }
  const cause = signal
    ? `morto por ${signal}`
    : code === 134
      ? 'abortado (provável falta de memória)'
      : `saiu com código ${code}`;
  if (consecutiveCrashes >= maxRestarts) {
    return {
      action: 'stop',
      status: 'failed',
      reason: `${cause}; já foram ${consecutiveCrashes} recuperações seguidas sem entregar nada`,
    };
  }
  return { action: 'recover', waitMs: restartWait(consecutiveCrashes), reason: cause };
}
