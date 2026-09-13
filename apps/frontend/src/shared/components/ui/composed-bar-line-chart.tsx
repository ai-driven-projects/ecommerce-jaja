'use client';

import type { ReactNode } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/shared/lib/class-name.util';

type ChartValue = string | number | null | undefined;
type ChartDatum = object;

type ComposedBarLineChartProps<TData extends ChartDatum> = {
  data: TData[];
  xKey: keyof TData & string;
  barKey: keyof TData & string;
  lineKey: keyof TData & string;
  barLabel?: string;
  lineLabel?: string;
  barColor?: string;
  lineColor?: string;
  height?: number;
  className?: string;
  emptyState?: ReactNode;
  xAxisTickFormatter?: (value: ChartValue) => string;
  tooltipLabelFormatter?: (value: ChartValue) => string;
  valueFormatter?: (value: number, dataKey: string) => string;
};

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

const AXIS_TICK_STYLE = { fill: 'var(--muted-ink)', fontSize: 12, fontFamily: 'var(--font-ui)' };

const DEFAULT_EMPTY_STATE = (
  <div className="flex h-full items-center rounded-2xl border border-dashed border-line px-6 text-sm text-muted-ink">
    Nenhum dado disponível para exibir no gráfico.
  </div>
);

export function ComposedBarLineChart<TData extends ChartDatum>({
  data,
  xKey,
  barKey,
  lineKey,
  barLabel = 'Barras',
  lineLabel = 'Linha',
  barColor = 'var(--brand)',
  lineColor = 'var(--brand)',
  height = 320,
  className,
  emptyState = DEFAULT_EMPTY_STATE,
  xAxisTickFormatter,
  tooltipLabelFormatter,
  valueFormatter,
}: ComposedBarLineChartProps<TData>) {
  const formatValue = (value: number, dataKey: string) => {
    if (valueFormatter) {
      return valueFormatter(value, dataKey);
    }

    return new Intl.NumberFormat('pt-BR').format(value);
  };

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
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            axisLine={{ stroke: 'var(--line)', strokeWidth: 1 }}
            dataKey={xKey as string}
            minTickGap={24}
            tickLine={false}
            tickMargin={10}
            tick={AXIS_TICK_STYLE}
            tickFormatter={xAxisTickFormatter ? (value) => xAxisTickFormatter(value as ChartValue) : undefined}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={AXIS_TICK_STYLE}
            tickFormatter={(value: number) => formatValue(value, '')}
            width={80}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--ink)' }}
            cursor={{ fill: 'var(--surface)' }}
            formatter={(value, name) => {
              const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;

              return [formatValue(Number.isFinite(numericValue) ? numericValue : 0, String(name)), String(name)];
            }}
            labelFormatter={(value) =>
              tooltipLabelFormatter ? tooltipLabelFormatter(value as ChartValue) : String(value)
            }
            wrapperStyle={{ outline: 'none' }}
          />
          <Legend
            verticalAlign="top"
            align="left"
            iconType="square"
            height={32}
            wrapperStyle={{ fontSize: '12px', color: 'var(--muted-ink)' }}
          />
          <Bar
            dataKey={barKey as string}
            fill={barColor}
            name={barLabel}
            radius={0}
            maxBarSize={40}
            isAnimationActive={false}
          />
          <Line
            dataKey={lineKey as string}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
            name={lineLabel}
            stroke={lineColor}
            strokeLinecap="square"
            strokeLinejoin="miter"
            strokeWidth={2}
            type="linear"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
