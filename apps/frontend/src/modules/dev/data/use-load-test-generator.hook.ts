'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/modules/auth/data/auth.context';
import { placeLoadTestOrder } from './load-test.api';
import { failureKey, latencyStats, runWithConcurrency, type LatencyStats } from './load-test.util';

/** Intervalo de atualização da tela durante a execução: as respostas chegam aos milhares. */
const PROGRESS_REFRESH_MS = 100;

/** Execuções guardadas no histórico da sessão (só na memória da aba). */
const HISTORY_SIZE = 10;

/** Resultado de uma execução do gerador, completo ou parcial. */
export type LoadTestRunResult = {
  runId: string;
  requested: number;
  /** `null`: todos de uma vez. */
  concurrency: number | null;
  /** `Date.now()` do disparo. */
  startedAt: number;
  sent: number;
  ok: number;
  failed: number;
  /** Do primeiro disparo à resposta mais recente. */
  elapsedMs: number;
  /** Ida e volta de cada pedido que deu certo, medida no navegador. */
  latency: LatencyStats | null;
  /** Tempo de cada pedido dentro da API (`serverMs`). */
  server: LatencyStats | null;
  /** Falhas agrupadas (`failureKey`), da mais frequente para a menos. */
  failures: Array<{ key: string; count: number }>;
  stopped: boolean;
  finished: boolean;
};

// Contadores mutáveis da execução em andamento; a tela lê uma cópia (`snapshot`).
type RunCounters = {
  runId: string;
  requested: number;
  concurrency: number | null;
  startedAt: number;
  t0: number;
  sent: number;
  ok: number;
  failed: number;
  elapsedMs: number;
  latencies: number[];
  serverMs: number[];
  failures: Map<string, number>;
  stopped: boolean;
  finished: boolean;
};

function snapshot(counters: RunCounters): LoadTestRunResult {
  return {
    runId: counters.runId,
    requested: counters.requested,
    concurrency: counters.concurrency,
    startedAt: counters.startedAt,
    sent: counters.sent,
    ok: counters.ok,
    failed: counters.failed,
    elapsedMs: counters.elapsedMs,
    latency: latencyStats(counters.latencies),
    server: latencyStats(counters.serverMs),
    failures: [...counters.failures.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    stopped: counters.stopped,
    finished: counters.finished,
  };
}

export type UseLoadTestGeneratorOptions = {
  /** Chamado no disparo, com o `runId` da execução (o painel da fila passa a segui-la). */
  onRunStart?: (runId: string) => void;
};

/**
 * Gerador do teste de carga: dispara `count` pedidos (`POST /dev/load-test/orders`)
 * de uma vez (`concurrency: null`) ou com no máximo `concurrency` em andamento, e
 * mede cada ida e volta com `performance.now()`.
 *
 * - `current` é a execução em andamento ou a última; atualizada a cada
 *   `PROGRESS_REFRESH_MS` enquanto roda e uma última vez ao terminar.
 * - `stop` não cancela as requisições já enviadas: só impede as próximas.
 * - `history` guarda as últimas execuções da aba, da mais nova para a mais antiga.
 * - Uma execução por vez; sem sessão, `start` não faz nada.
 */
export function useLoadTestGenerator({ onRunStart }: UseLoadTestGeneratorOptions = {}) {
  const { session } = useAuth();
  const token = session?.token;

  const [current, setCurrent] = useState<LoadTestRunResult | null>(null);
  const [history, setHistory] = useState<LoadTestRunResult[]>([]);
  const countersRef = useRef<RunCounters | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Sair da tela para a execução: nada novo é disparado.
      if (countersRef.current) countersRef.current.stopped = true;
    };
  }, []);

  const running = current !== null && !current.finished;

  const start = useCallback(
    async (count: number, concurrency: number | null) => {
      if (!token || (countersRef.current && !countersRef.current.finished)) return;

      const counters: RunCounters = {
        runId: crypto.randomUUID(),
        requested: count,
        concurrency,
        startedAt: Date.now(),
        t0: performance.now(),
        sent: 0,
        ok: 0,
        failed: 0,
        elapsedMs: 0,
        latencies: [],
        serverMs: [],
        failures: new Map(),
        stopped: false,
        finished: false,
      };
      countersRef.current = counters;
      setCurrent(snapshot(counters));
      onRunStart?.(counters.runId);

      const refresh = window.setInterval(() => {
        counters.elapsedMs = performance.now() - counters.t0;
        if (mountedRef.current) setCurrent(snapshot(counters));
      }, PROGRESS_REFRESH_MS);

      const fire = async () => {
        counters.sent++;
        const sentAt = performance.now();
        try {
          const placed = await placeLoadTestOrder(token, counters.runId);
          counters.ok++;
          counters.latencies.push(performance.now() - sentAt);
          counters.serverMs.push(placed.serverMs);
        } catch (error: unknown) {
          counters.failed++;
          const key = failureKey(error);
          counters.failures.set(key, (counters.failures.get(key) ?? 0) + 1);
        } finally {
          counters.elapsedMs = performance.now() - counters.t0;
        }
      };

      try {
        await runWithConcurrency(count, concurrency, fire, () => counters.stopped);
      } finally {
        window.clearInterval(refresh);
        counters.finished = true;
        const result = snapshot(counters);
        if (mountedRef.current) {
          setCurrent(result);
          setHistory((previous) => [result, ...previous].slice(0, HISTORY_SIZE));
        }
      }
    },
    [token, onRunStart],
  );

  const stop = useCallback(() => {
    if (countersRef.current) countersRef.current.stopped = true;
  }, []);

  return { current, history, running, canStart: Boolean(token) && !running, start, stop };
}
