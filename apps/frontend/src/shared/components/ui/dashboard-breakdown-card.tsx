'use client';

import { RefreshCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PieBreakdownChart } from '@/shared/components/ui/pie-breakdown-chart';
import { cn } from '@/shared/lib/class-name.util';

type DashboardBreakdownCardProps = {
  title: string;
  subtitle: string;
  items: Array<{
    label: string;
    totalAmount: number;
    amountLabel: string;
    color: string;
  }>;
  error: string | null;
  isLoading: boolean;
  selectedMonths: number;
  onRefresh: () => Promise<void>;
  accentClassName: string;
};

export function DashboardBreakdownCard({
  title,
  subtitle,
  items,
  error,
  isLoading,
  selectedMonths,
  onRefresh,
  accentClassName,
}: DashboardBreakdownCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {accentClassName ? (
        <div className={cn('pointer-events-none absolute inset-0', accentClassName)} aria-hidden="true" />
      ) : null}

      <CardHeader className="relative pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle>{title}</CardTitle>
            <p className="max-w-xl text-[12.5px] text-muted-ink">{subtitle}</p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            aria-label={`Atualizar ${title.toLowerCase()}`}
            title={`Atualizar ${title.toLowerCase()}`}
          >
            <RefreshCcw className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5 pt-6">
        {error ? <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div> : null}

        {!error ? (
          <>
            <PieBreakdownChart
              data={items.map((item) => ({
                label: item.label,
                value: item.totalAmount,
                color: item.color,
              }))}
              height={340}
              showLegend={false}
              valueFormatter={(value) =>
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(value)
              }
              emptyState={
                <div
                  className={cn(
                    'flex h-full items-center rounded-2xl border border-dashed px-6 text-sm',
                    isLoading ? 'border-line text-placeholder' : 'border-line text-muted-ink',
                  )}
                >
                  {isLoading
                    ? `Carregando ${title.toLowerCase()}...`
                    : `Nenhum dado disponível para os últimos ${selectedMonths} meses.`}
                </div>
              }
            />

            {!isLoading && items.length > 0 ? (
              <ul className="divide-y divide-line">
                {items.slice(0, 6).map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <p className="truncate text-sm font-semibold text-ink">{item.label}</p>
                    </div>

                    <p className="shrink-0 text-sm font-extrabold tabular-nums text-ink">{item.amountLabel}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
