'use client';

import type { ReactNode } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/shared/lib/class-name.util';

type PieBreakdownChartDatum = {
  label: string;
  value: number;
  color?: string;
};

type PieBreakdownChartProps = {
  data: PieBreakdownChartDatum[];
  height?: number;
  className?: string;
  emptyState?: ReactNode;
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showPercentageInTooltip?: boolean;
};

// Paleta do design: tinta, vermelho e os cinzas do sistema. Sem cores extras.
const DEFAULT_COLORS = ['var(--brand)', 'var(--success)', 'var(--ink)', 'var(--warning)'];

const TOOLTIP_STYLE = {
  border: '1px solid var(--line)',
  borderRadius: 12,
  backgroundColor: 'var(--card)',
  boxShadow: 'none',
  color: 'var(--ink)',
  fontFamily: 'var(--font-ui)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '12px',
} as const;

const DEFAULT_EMPTY_STATE = (
  <div className="flex h-full items-center rounded-2xl border border-dashed border-line px-6 text-sm text-muted-ink">
    Nenhum dado disponível para exibir no gráfico.
  </div>
);

export function PieBreakdownChart({
  data,
  height = 320,
  className,
  emptyState = DEFAULT_EMPTY_STATE,
  valueFormatter,
  showLegend = true,
  showPercentageInTooltip = false,
}: PieBreakdownChartProps) {
  const formatValue = (value: number) => {
    if (valueFormatter) {
      return valueFormatter(value);
    }

    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const totalValue = data.reduce((total, item) => total + item.value, 0);

  if (data.length === 0) {
    return (
      <div className={className} style={{ height }}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--ink)' }}
            formatter={(value, name, item) => {
              const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;

              const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
              const percentage = totalValue > 0 ? (safeValue / totalValue) * 100 : 0;

              return [
                showPercentageInTooltip
                  ? `${formatValue(safeValue)} · ${percentage.toFixed(1).replace('.', ',')}%`
                  : formatValue(safeValue),
                String(name ?? item?.name ?? ''),
              ];
            }}
            wrapperStyle={{ outline: 'none' }}
          />
          {showLegend ? (
            <Legend
              verticalAlign="bottom"
              align="left"
              iconType="square"
              wrapperStyle={{ fontSize: '12px', color: 'var(--muted-ink)' }}
            />
          ) : null}
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={72}
            outerRadius={108}
            paddingAngle={0}
            cornerRadius={0}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((item, index) => (
              <Cell key={`${item.label}-${index}`} fill={item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
