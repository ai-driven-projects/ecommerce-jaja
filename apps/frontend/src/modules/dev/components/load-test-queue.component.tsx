'use client';

import { memo, useMemo } from 'react';
import type { OrderStatus } from '@/modules/orders/data/order.api';
import { ORDER_STATUS_LABEL, ORDER_STEPS } from '@/modules/orders/data/order-status.util';
import { cn } from '@/shared/lib/class-name.util';
import type { LoadTestRun } from '../data/load-test.api';
import { formatCount, formatMs, formatRate, type LoadTestQueueNumbers } from '../data/load-test.util';
import type { LoadTestQueueSample } from '../data/use-load-test-queue.hook';

/** Cor de cada status na fila: do laranja claro (recebido) ao verde (entregue). */
const STATUS_COLOR: Readonly<Record<OrderStatus, string>> = {
  PLACED: 'bg-brand-pale',
  PAYMENT_APPROVED: 'bg-brand-light',
  PICKING: 'bg-warning',
  OUT_FOR_DELIVERY: 'bg-success-light',
  DELIVERED: 'bg-success',
};

/** Quadradinhos desenhados na fila; acima disso, o resto vira "+N". */
const MAX_CELLS = 2_000;

/** Janela usada para a velocidade de saída da fila. */
const DRAIN_WINDOW_MS = 10_000;

const CHART_WIDTH = 600;
const CHART_HEIGHT = 120;

type LoadTestQueueProps = {
  runId: string | null;
  run: LoadTestRun | null;
  numbers: LoadTestQueueNumbers;
  samples: LoadTestQueueSample[];
  error: string | null;
  loading: boolean;
};

/** Pedidos entregues por segundo na janela mais recente de `DRAIN_WINDOW_MS`. */
function drainRate(samples: readonly LoadTestQueueSample[]): number | null {
  const last = samples[samples.length - 1];
  if (!last) return null;
  const first = samples.find((sample) => sample.at >= last.at - DRAIN_WINDOW_MS) ?? last;
  const seconds = (last.at - first.at) / 1_000;
  return seconds > 0 ? (last.delivered - first.delivered) / seconds : null;
}

/** Área do tamanho da fila ao longo do tempo (SVG simples, escala pelo maior valor). */
const QueueChart = memo(function QueueChart({ samples }: { samples: LoadTestQueueSample[] }) {
  if (samples.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-xl bg-surface text-[13px] text-muted-ink">
        O gráfico da fila aparece com as primeiras leituras.
      </div>
    );
  }

  const start = samples[0]!.at;
  const span = Math.max(1, samples[samples.length - 1]!.at - start);
  const peak = Math.max(1, ...samples.map((sample) => sample.inQueue));
  const points = samples.map((sample) => {
    const x = ((sample.at - start) / span) * CHART_WIDTH;
    const y = CHART_HEIGHT - (sample.inQueue / peak) * (CHART_HEIGHT - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(' ');

  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-[120px] w-full rounded-xl bg-surface"
        role="img"
        aria-label={`Tamanho da fila ao longo de ${formatMs(span)}; pico de ${formatCount(peak)} pedidos`}
      >
        <polygon points={`0,${CHART_HEIGHT} ${line} ${CHART_WIDTH},${CHART_HEIGHT}`} className="fill-brand-soft" />
        <polyline points={line} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2} className="stroke-brand" />
      </svg>
      <figcaption className="flex justify-between text-xs tabular-nums text-muted-ink">
        <span>pico {formatCount(peak)}</span>
        <span>{formatMs(span)} de acompanhamento</span>
      </figcaption>
    </figure>
  );
});

/** Os pedidos ainda na fila, um quadradinho por pedido na cor do status; o entregue sai. */
const QueueCells = memo(function QueueCells({ run }: { run: LoadTestRun }) {
  const waiting = useMemo(() => run.orders.filter((order) => order.status !== 'DELIVERED'), [run.orders]);
  const shown = waiting.slice(0, MAX_CELLS);

  if (waiting.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-success-soft text-[13.5px] font-bold text-success">
        Fila vazia: todos os pedidos foram entregues.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex max-h-[320px] flex-wrap gap-[3px] overflow-y-auto rounded-xl bg-surface p-2.5" aria-label="Pedidos na fila">
        {shown.map((order) => (
          <li
            key={order.id}
            title={`${order.id.slice(0, 8).toUpperCase()} · ${ORDER_STATUS_LABEL[order.status] ?? order.status}`}
            className={cn('size-2.5 rounded-[3px]', STATUS_COLOR[order.status] ?? 'bg-placeholder')}
          />
        ))}
      </ul>
      {waiting.length > shown.length ? (
        <p className="text-xs text-muted-ink">+{formatCount(waiting.length - shown.length)} pedidos fora do quadro</p>
      ) : null}
    </div>
  );
});

/**
 * Fila ao vivo de uma execução do teste: quantos pedidos ainda não foram
 * entregues, a barra por status, o gráfico do tamanho da fila, a velocidade de
 * saída e um quadradinho por pedido em andamento, que some quando o pedido é
 * entregue.
 */
export const LoadTestQueue = memo(function LoadTestQueue({ runId, run, numbers, samples, error, loading }: LoadTestQueueProps) {
  const rate = drainRate(samples);

  return (
    <section aria-labelledby="load-test-queue-title" className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-card p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="load-test-queue-title" className="font-display text-[19px] font-extrabold tracking-[-0.3px] text-ink">
          Fila de processamento
        </h2>
        <p className="text-[13px] text-muted-ink">
          {runId ? (
            <>
              Execução <span className="font-bold tabular-nums text-ink-soft">{runId.slice(0, 8)}</span> · cada pedido passa
              por pagamento, separação e entrega e sai da fila ao ser entregue.
            </>
          ) : (
            'Dispare pedidos no gerador para acompanhar a fila aqui.'
          )}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-3 text-[13px] font-bold text-danger">
          {error}
        </p>
      ) : null}

      {!runId ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl bg-surface text-center">
          <span className="text-[34px]" aria-hidden="true">
            📦
          </span>
          <p className="text-[13.5px] font-bold text-ink-soft">Nenhuma execução acompanhada.</p>
        </div>
      ) : loading || !run ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="h-24 rounded-xl bg-surface" />
          <div className="h-[120px] rounded-xl bg-surface" />
          <div className="h-32 rounded-xl bg-surface" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="col-span-2 rounded-xl bg-brand-soft px-4 py-3 sm:col-span-1">
              <p className="text-xs font-bold text-brand">Na fila</p>
              <p className="mt-1 font-display text-[34px] font-extrabold leading-none tracking-[-0.6px] tabular-nums text-brand" aria-live="polite">
                {formatCount(numbers.inQueue)}
              </p>
            </div>
            <div className="rounded-xl bg-surface px-4 py-3">
              <p className="text-xs font-bold text-muted-ink">Entregues</p>
              <p className="mt-1 font-display text-[22px] font-extrabold leading-none tabular-nums text-success">
                {formatCount(numbers.delivered)}
                <span className="text-[13px] font-bold text-muted-ink"> / {formatCount(numbers.total)}</span>
              </p>
            </div>
            <div className="rounded-xl bg-surface px-4 py-3">
              <p className="text-xs font-bold text-muted-ink">Saída da fila</p>
              <p className="mt-1 font-display text-[22px] font-extrabold leading-none tabular-nums text-ink">
                {rate === null ? '—' : formatRate(rate)}
              </p>
            </div>
            <div className="rounded-xl bg-surface px-4 py-3">
              <p className="text-xs font-bold text-muted-ink">{numbers.cycleMs !== null ? 'Ciclo completo' : 'Tempo médio'}</p>
              <p className="mt-1 font-display text-[22px] font-extrabold leading-none tabular-nums text-ink">
                {numbers.cycleMs !== null
                  ? formatMs(numbers.cycleMs)
                  : numbers.averageLeadMs !== null
                    ? formatMs(numbers.averageLeadMs)
                    : '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex h-3 overflow-hidden rounded-pill bg-surface" aria-hidden="true">
              {numbers.total > 0
                ? ORDER_STEPS.map((step) => {
                    const count = run.byStatus[step.status] ?? 0;
                    return count > 0 ? (
                      <div
                        key={step.status}
                        className={cn('h-full transition-[width] duration-150', STATUS_COLOR[step.status])}
                        style={{ width: `${(count / numbers.total) * 100}%` }}
                      />
                    ) : null;
                  })
                : null}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
              {ORDER_STEPS.map((step) => (
                <li key={step.status} className="inline-flex items-center gap-1.5 text-ink-soft">
                  <span className={cn('size-2.5 rounded-[3px]', STATUS_COLOR[step.status])} aria-hidden="true" />
                  {step.label}
                  <span className="font-extrabold tabular-nums text-ink">{formatCount(run.byStatus[step.status] ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>

          <QueueChart samples={samples} />

          {numbers.total === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl bg-surface text-[13px] text-muted-ink">
              Aguardando os primeiros pedidos desta execução…
            </div>
          ) : (
            <QueueCells run={run} />
          )}
        </>
      )}
    </section>
  );
});
