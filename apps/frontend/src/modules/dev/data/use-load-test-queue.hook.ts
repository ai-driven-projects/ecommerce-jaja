'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/modules/auth/data/auth.context';
import { createCoalescedRead } from '@/modules/orders/data/coalesced-read.util';
import { useOrdersLive } from '@/modules/orders/data/orders-live.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getLoadTestRun, type LoadTestRun } from './load-test.api';
import { queueNumbers } from './load-test.util';

/** Menor intervalo entre duas leituras: um teste de 1.000 pedidos gera ~5.000 avisos. */
const MIN_READ_INTERVAL_MS = 1_000;

/** Leitura de segurança enquanto há fila, caso algum aviso se perca. */
const FALLBACK_POLL_MS = 3_000;

/** Pontos guardados para o gráfico da fila (≈10 min a uma leitura por segundo). */
const MAX_SAMPLES = 600;

/** Tamanho da fila num instante, para o gráfico. */
export type LoadTestQueueSample = {
  /** `Date.now()` da leitura. */
  at: number;
  inQueue: number;
  delivered: number;
};

type QueueState = {
  /** Chave da leitura (sessão + execução): a de outra chave não vale. */
  key: string;
  run: LoadTestRun | null;
  samples: LoadTestQueueSample[];
  error: string | null;
};

/**
 * Fila de uma execução do teste de carga (`GET /dev/load-test/runs/:runId`), ao
 * vivo: relê a cada aviso do stream administrativo (`useOrdersLive`) e a cada
 * reconexão, com no máximo uma leitura por `MIN_READ_INTERVAL_MS` (as pendentes
 * viram uma, como em `useLiveRefetch`) e uma leitura de segurança a cada
 * `FALLBACK_POLL_MS` enquanto houver pedido não entregue. O aviso é só um sinal:
 * a fila vem sempre da API.
 *
 * - `run` é `null` antes da primeira resposta e sem `runId`;
 * - `samples` acumula o tamanho da fila de cada leitura (o gráfico);
 * - uma falha mantém a última fila e preenche `error`, que some na próxima leitura boa.
 */
export function useLoadTestQueue(runId: string | null) {
  const { session } = useAuth();
  const token = session?.token;
  const { subscribe } = useOrdersLive();
  const key = token && runId ? `${token}:${runId}` : null;
  const [state, setState] = useState<QueueState | null>(null);

  useEffect(() => {
    if (!token || !runId || !key) return;

    let active = true;
    let lastReadAt = 0;
    let delayed: number | undefined;
    let poll: number | undefined;

    const reader = createCoalescedRead(async () => {
      lastReadAt = Date.now();
      try {
        const run = await getLoadTestRun(token, runId);
        if (!active) return;
        const numbers = queueNumbers(run);
        const sample = { at: Date.now(), inQueue: numbers.inQueue, delivered: numbers.delivered };
        setState((previous) => ({
          key,
          run,
          samples: [...(previous?.key === key ? previous.samples : []), sample].slice(-MAX_SAMPLES),
          error: null,
        }));
        schedulePoll(numbers.inQueue > 0);
      } catch (error: unknown) {
        if (!active) return;
        setState((previous) => ({
          key,
          run: previous?.key === key ? previous.run : null,
          samples: previous?.key === key ? previous.samples : [],
          error: toErrorMessage(error),
        }));
        schedulePoll(true);
      }
    });

    // Respeita o intervalo mínimo; pedidos durante a espera viram um só.
    const request = () => {
      if (!active || delayed !== undefined) return;
      const wait = lastReadAt + MIN_READ_INTERVAL_MS - Date.now();
      if (wait <= 0) {
        reader.run();
        return;
      }
      delayed = window.setTimeout(() => {
        delayed = undefined;
        reader.run();
      }, wait);
    };

    function schedulePoll(enabled: boolean) {
      window.clearTimeout(poll);
      poll = enabled && active ? window.setTimeout(request, FALLBACK_POLL_MS) : undefined;
    }

    reader.run();
    const unsubscribe = subscribe(() => request());

    return () => {
      active = false;
      reader.stop();
      window.clearTimeout(delayed);
      window.clearTimeout(poll);
      unsubscribe();
    };
  }, [token, runId, key, subscribe]);

  const current = key && state?.key === key ? state : null;
  const numbers = useMemo(() => queueNumbers(current?.run ?? null), [current?.run]);

  return {
    run: current?.run ?? null,
    samples: current?.samples ?? [],
    numbers,
    error: current?.error ?? null,
    loading: Boolean(key) && current === null,
  };
}
