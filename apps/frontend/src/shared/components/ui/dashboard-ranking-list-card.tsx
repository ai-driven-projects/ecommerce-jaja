'use client';

import { RefreshCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Combobox } from '@/shared/components/ui/combobox';
import { cn } from '@/shared/lib/class-name.util';

type DashboardRankingListCardProps = {
  title: string;
  subtitle: string;
  items: Array<{
    id?: string;
    description: string;
    amountLabel: string;
    dateLabel: string;
  }>;
  error: string | null;
  isLoading: boolean;
  selectedMonths: number;
  selectedLimitValue: string;
  setSelectedLimitValue: (value: string) => void;
  onRefresh: () => Promise<void>;
  accentClassName: string;
  amountClassName: string;
  limitOptions: ReadonlyArray<{ value: string; label: string }>;
  emptyLabel: string;
  dateLabelPrefix?: string;
};

export function DashboardRankingListCard({
  title,
  subtitle,
  items,
  error,
  isLoading,
  selectedMonths,
  selectedLimitValue,
  setSelectedLimitValue,
  onRefresh,
  amountClassName,
  limitOptions,
  emptyLabel,
  dateLabelPrefix,
}: DashboardRankingListCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="max-w-xl">{subtitle}</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="min-w-[140px]">
              <Combobox
                options={[...limitOptions]}
                value={selectedLimitValue}
                onChange={setSelectedLimitValue}
                placeholder="Qtd. itens"
              />
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
        </div>
      </CardHeader>

      <CardContent>
        {error ? <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div> : null}

        {!error ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-8 text-sm text-placeholder">
                Carregando {title.toLowerCase()}...
              </div>
            ) : null}

            {!isLoading && items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-8 text-sm text-muted-ink">
                Nenhum {emptyLabel} encontrado para os últimos {selectedMonths} meses.
              </div>
            ) : null}

            {!isLoading && items.length > 0 ? (
              <ol className="divide-y divide-line">
                {items.map((item, index) => (
                  <li key={item.id ?? `${item.description}-${item.dateLabel}-${index}`} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-extrabold text-muted-ink">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{item.description}</p>
                        <p className="mt-0.5 text-xs text-muted-ink">
                          {dateLabelPrefix ? `${dateLabelPrefix}: ` : null}
                          {item.dateLabel}
                        </p>
                      </div>
                    </div>

                    <p className={cn('shrink-0 text-sm font-extrabold tabular-nums', amountClassName)}>{item.amountLabel}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
