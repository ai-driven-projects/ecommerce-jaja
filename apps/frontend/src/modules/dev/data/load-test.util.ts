import { ApiError } from '@/shared/util/api-client.util';
import type { LoadTestRun } from './load-test.api';

// Contas e formatação do teste de carga: estatística das latências, execução com
// limite de concorrência e os números da fila.

/** Quantidades prontas do gerador. */
export const LOAD_TEST_COUNT_PRESETS = [10, 100, 500, 1_000] as const;

/** Limite do campo de quantidade (a API aceita qualquer número; o navegador, nem tanto). */
export const LOAD_TEST_MAX_COUNT = 5_000;

/** Concorrência: `null` dispara todos de uma vez; um número limita as requisições em andamento. */
export const LOAD_TEST_CONCURRENCY_OPTIONS: ReadonlyArray<{ label: string; value: number | null }> = [
  { label: 'Todos de uma vez', value: null },
  { label: '100 por vez', value: 100 },
  { label: '20 por vez', value: 20 },
];

export type LatencyStats = {
  count: number;
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percentil `p` (0–100) pelo método do posto mais próximo; `sorted` em ordem crescente e não vazio. */
export function percentile(sorted: readonly number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

/** Mínimo, média, p50, p95, p99 e máximo; `null` sem valores. */
export function latencyStats(values: readonly number[]): LatencyStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    count: sorted.length,
    min: sorted[0]!,
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1]!,
  };
}

/** "850 ms" abaixo de 1 s; "1,23 s" até 1 min; daí "2 min 05 s". */
export function formatMs(ms: number): string {
  const value = Math.max(0, ms);
  if (value < 1_000) return `${integer.format(value)} ms`;
  if (value < 60_000) return `${twoDecimals.format(value / 1_000)} s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.floor((value % 60_000) / 1_000);
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

/** "12,5/s". */
export function formatRate(perSecond: number): string {
  return `${decimal.format(Math.max(0, perSecond))}/s`;
}

/** "1.000". */
export function formatCount(value: number): string {
  return integer.format(value);
}

/** Chave da falha para agrupar: "400 · LOAD_TEST_NO_PRODUCTS", "500" ou a mensagem de rede. */
export function failureKey(error: unknown): string {
  if (error instanceof ApiError) return error.codes.length ? `${error.status} · ${error.codes.join(', ')}` : String(error.status);
  return error instanceof Error && error.message ? error.message : 'Falha desconhecida';
}

/**
 * Roda `task` `count` vezes com no máximo `limit` em andamento (`null`: todas de
 * uma vez, sem esperar nenhuma). `shouldStop` é consultado antes de cada nova
 * chamada: as que já começaram terminam. Resolve quando todas as começadas
 * terminarem; `task` não deve rejeitar (trata os próprios erros).
 */
export async function runWithConcurrency(
  count: number,
  limit: number | null,
  task: () => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  if (limit === null) {
    const running: Promise<void>[] = [];
    for (let index = 0; index < count && !shouldStop(); index++) running.push(task());
    await Promise.all(running);
    return;
  }

  let next = 0;
  const worker = async () => {
    while (next < count && !shouldStop()) {
      next++;
      await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
}

/** Números da fila de uma execução. */
export type LoadTestQueueNumbers = {
  total: number;
  /** Pedidos ainda não entregues: a fila. */
  inQueue: number;
  delivered: number;
  /** Do primeiro pedido feito à última entrega, quando tudo foi entregue. */
  cycleMs: number | null;
  /** Média de `deliveredAt - placedAt` dos entregues. */
  averageLeadMs: number | null;
};

export function queueNumbers(run: LoadTestRun | null): LoadTestQueueNumbers {
  const orders = run?.orders ?? [];
  const delivered = orders.filter((order) => order.deliveredAt);
  const inQueue = orders.length - delivered.length;

  const leads = delivered.map((order) => new Date(order.deliveredAt!).getTime() - new Date(order.placedAt).getTime());
  const averageLeadMs = leads.length ? leads.reduce((total, lead) => total + lead, 0) / leads.length : null;

  let cycleMs: number | null = null;
  if (orders.length > 0 && inQueue === 0) {
    const firstPlaced = Math.min(...orders.map((order) => new Date(order.placedAt).getTime()));
    const lastDelivered = Math.max(...delivered.map((order) => new Date(order.deliveredAt!).getTime()));
    cycleMs = lastDelivered - firstPlaced;
  }

  return { total: orders.length, inQueue, delivered: delivered.length, cycleMs, averageLeadMs };
}
