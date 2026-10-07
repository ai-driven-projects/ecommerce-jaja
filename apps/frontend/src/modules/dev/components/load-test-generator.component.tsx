'use client';

import { useState, type ReactNode } from 'react';
import { Square, Zap } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/class-name.util';
import type { LoadTestPoolSummary } from '../data/load-test.api';
import {
  LOAD_TEST_CONCURRENCY_OPTIONS,
  LOAD_TEST_COUNT_PRESETS,
  LOAD_TEST_MAX_COUNT,
  formatCount,
  formatMs,
  formatRate,
} from '../data/load-test.util';
import type { LoadTestRunResult } from '../data/use-load-test-generator.hook';

type LoadTestGeneratorProps = {
  pool: LoadTestPoolSummary | null;
  /** A API não tem as ferramentas ligadas, ou o sorteio falhou: nada a disparar. */
  unavailable: string | null;
  current: LoadTestRunResult | null;
  history: LoadTestRunResult[];
  running: boolean;
  canStart: boolean;
  /** Execução seguida pela fila (destacada no histórico). */
  followedRunId: string | null;
  onStart: (count: number, concurrency: number | null) => void;
  onStop: () => void;
  onFollow: (runId: string) => void;
};

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-pill border px-[15px] py-2 text-[13.5px] font-bold tabular-nums transition-colors duration-150 disabled:opacity-50',
        active ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-card text-ink hover:bg-surface',
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="rounded-xl bg-surface px-3.5 py-3">
      <p className="text-xs font-bold text-muted-ink">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-[22px] font-extrabold leading-none tracking-[-0.4px] tabular-nums text-ink',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-ink">{hint}</p> : null}
    </div>
  );
}

const LATENCY_COLUMNS = [
  { key: 'min', label: 'mín' },
  { key: 'avg', label: 'média' },
  { key: 'p50', label: 'p50' },
  { key: 'p95', label: 'p95' },
  { key: 'p99', label: 'p99' },
  { key: 'max', label: 'máx' },
] as const;

function concurrencyLabel(value: number | null): string {
  return value === null ? 'todos de uma vez' : `${value} por vez`;
}

/** Resultado da execução: progresso, tempos, vazão, latências e falhas. */
function RunResult({ run }: { run: LoadTestRunResult }) {
  const answered = run.ok + run.failed;
  const progress = run.requested > 0 ? answered / run.requested : 0;
  const seconds = run.elapsedMs / 1_000;

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-bold">
          <span className="text-ink">
            {run.finished ? (run.stopped ? 'Interrompido' : 'Concluído') : 'Recebendo respostas…'}
          </span>
          <span className="tabular-nums text-muted-ink">
            {formatCount(answered)} / {formatCount(run.requested)}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-pill bg-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.requested}
          aria-valuenow={answered}
          aria-label="Respostas recebidas"
        >
          <div className="h-full rounded-pill bg-brand transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Tempo total" value={formatMs(run.elapsedMs)} hint="do disparo à última resposta" />
        <Stat label="Vazão" value={formatRate(seconds > 0 ? run.ok / seconds : 0)} hint="pedidos aceitos por segundo" />
        <Stat label="Aceitos" value={formatCount(run.ok)} tone="success" hint={`${formatCount(run.sent)} enviados`} />
        <Stat label="Falhas" value={formatCount(run.failed)} tone={run.failed > 0 ? 'danger' : undefined} hint={concurrencyLabel(run.concurrency)} />
      </div>

      {run.latency ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[380px] whitespace-nowrap text-[12.5px] tabular-nums">
            <thead>
              <tr className="bg-surface text-left text-xs font-extrabold uppercase tracking-[0.04em] text-muted-ink">
                <th className="px-2.5 py-2">Latência</th>
                {LATENCY_COLUMNS.map((column) => (
                  <th key={column.key} className="px-1.5 py-2 text-right">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-2.5 py-2 font-bold text-ink" title="Ida e volta medida no navegador">
                  Navegador
                </td>
                {LATENCY_COLUMNS.map((column) => (
                  <td key={column.key} className="px-1.5 py-2 text-right text-ink">
                    {formatMs(run.latency![column.key])}
                  </td>
                ))}
              </tr>
              {run.server ? (
                <tr className="border-t border-line">
                  <td className="px-2.5 py-2 font-bold text-ink" title="Tempo dentro da API (plano + transação do pedido)">
                    Servidor
                  </td>
                  {LATENCY_COLUMNS.map((column) => (
                    <td key={column.key} className="px-1.5 py-2 text-right text-ink-soft">
                      {formatMs(run.server![column.key])}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {run.failures.length > 0 ? (
        <ul className="flex flex-col gap-1.5 rounded-xl bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
          {run.failures.map((failure) => (
            <li key={failure.key} className="flex justify-between gap-3">
              <span className="min-w-0 break-words font-bold">{failure.key}</span>
              <span className="shrink-0 font-extrabold tabular-nums">{formatCount(failure.count)}×</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Gerador do teste de carga: quantidade (atalhos ou valor livre até
 * `LOAD_TEST_MAX_COUNT`), concorrência e o botão de disparo; depois, o resultado
 * da execução e o histórico da aba, em que um clique passa a seguir a execução na
 * fila.
 */
export function LoadTestGenerator({
  pool,
  unavailable,
  current,
  history,
  running,
  canStart,
  followedRunId,
  onStart,
  onStop,
  onFollow,
}: LoadTestGeneratorProps) {
  const [count, setCount] = useState<number>(100);
  const [countInput, setCountInput] = useState('100');
  const [concurrency, setConcurrency] = useState<number | null>(null);

  const validCount = Number.isInteger(count) && count >= 1 && count <= LOAD_TEST_MAX_COUNT;
  const startDisabled = !canStart || !validCount || Boolean(unavailable) || !pool;

  const handleCountInput = (value: string) => {
    setCountInput(value);
    setCount(value.trim() === '' ? 0 : Number(value));
  };

  const choosePreset = (value: number) => {
    setCount(value);
    setCountInput(String(value));
  };

  return (
    <section aria-labelledby="load-test-generator-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="load-test-generator-title" className="font-display text-[19px] font-extrabold tracking-[-0.3px] text-ink">
          Gerador de pedidos
        </h2>
        <p className="text-[13px] text-muted-ink">
          {pool
            ? `Cada pedido sorteia de 1 a 4 produtos entre ${formatCount(pool.products)} da vitrine e um cliente entre ${formatCount(pool.customers)} ativos.`
            : unavailable
              ? 'Gerador indisponível nesta API.'
              : 'Carregando produtos e clientes do sorteio…'}
        </p>
      </div>

      {unavailable ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-3.5 py-3 text-[13px] font-bold text-warning">
          {unavailable}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2.5" disabled={running}>
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.04em] text-muted-ink">Quantidade</legend>
        <div className="flex flex-wrap items-center gap-2">
          {LOAD_TEST_COUNT_PRESETS.map((preset) => (
            <Chip key={preset} active={count === preset} onClick={() => choosePreset(preset)}>
              {formatCount(preset)}
            </Chip>
          ))}
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={LOAD_TEST_MAX_COUNT}
            step={1}
            value={countInput}
            onChange={(event) => handleCountInput(event.target.value)}
            aria-label="Quantidade de pedidos"
            aria-invalid={!validCount}
            className="h-[38px] w-28 tabular-nums"
          />
        </div>
        {!validCount ? (
          <p className="text-xs font-bold text-danger">Informe um número inteiro de 1 a {formatCount(LOAD_TEST_MAX_COUNT)}.</p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2.5" disabled={running}>
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.04em] text-muted-ink">Envio</legend>
        <div className="flex flex-wrap gap-2">
          {LOAD_TEST_CONCURRENCY_OPTIONS.map((option) => (
            <Chip key={option.label} active={concurrency === option.value} onClick={() => setConcurrency(option.value)}>
              {option.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        {running ? (
          <Button variant="secondary" size="lg" onClick={onStop} className="w-full">
            <Square className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Parar de enviar
          </Button>
        ) : (
          <Button size="lg" onClick={() => onStart(count, concurrency)} disabled={startDisabled} className="w-full">
            <Zap className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
            Disparar {validCount ? formatCount(count) : ''} {count === 1 ? 'pedido' : 'pedidos'}
          </Button>
        )}
        <p className="text-xs text-muted-ink">
          Cada pedido é real: entra no histórico do cliente sorteado e passa por pagamento, separação e entrega
          simulados até sair da fila.
        </p>
      </div>

      {current ? <RunResult run={current} /> : null}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.04em] text-muted-ink">Execuções desta aba</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {history.map((run) => {
              const followed = run.runId === followedRunId;
              return (
                <li key={run.runId}>
                  <button
                    type="button"
                    onClick={() => onFollow(run.runId)}
                    aria-pressed={followed}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-surface',
                      followed && 'bg-brand-soft hover:bg-brand-soft',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="font-bold tabular-nums text-ink">{formatCount(run.ok)} pedidos</span>
                      <span className="text-muted-ink"> · {concurrencyLabel(run.concurrency)}</span>
                      {run.failed > 0 ? <span className="font-bold text-danger"> · {formatCount(run.failed)} falhas</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-soft">
                      {formatMs(run.elapsedMs)}
                      {run.latency ? ` · p95 ${formatMs(run.latency.p95)}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
