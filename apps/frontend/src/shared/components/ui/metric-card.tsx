import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/class-name.util';

type DeltaTone = 'success' | 'danger' | 'warning' | 'muted';

type MetricCardProps = {
  /** Rótulo pequeno em cinza no topo. */
  title: ReactNode;
  /** Texto abaixo do valor (ex.: "↑ 12% vs. ontem" ou "Meta: 95%"). */
  subtitle?: ReactNode;
  value: ReactNode;
  /** Emoji ou ícone dentro do quadradinho pastel à direita. */
  icon?: ReactNode;
  /** Cor de fundo do quadradinho do ícone (`bg-tint-*`). */
  iconTintClassName?: string;
  deltaTone?: DeltaTone;
  className?: string;
  valueClassName?: string;
  /** Mantidos por compatibilidade de API. */
  iconColorClassName?: string;
  overlayClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  iconContainerClassName?: string;
};

const deltaToneClasses: Record<DeltaTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  muted: 'text-muted-ink',
};

/** Cartão de indicador: rótulo + ícone pastel, valor em display e variação. */
export function MetricCard({
  title,
  subtitle,
  value,
  icon,
  iconTintClassName = 'bg-brand-soft',
  deltaTone = 'muted',
  className,
  valueClassName,
  titleClassName,
  subtitleClassName,
  iconContainerClassName,
}: MetricCardProps) {
  return (
    <div className={cn('rounded-2xl border border-line bg-card px-5 py-[18px]', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className={cn('truncate text-[13px] font-bold text-muted-ink', titleClassName)}>{title}</span>
        {icon ? (
          <span
            className={cn(
              'flex size-[34px] shrink-0 items-center justify-center rounded-[10px] text-[17px] [&_svg]:size-[18px]',
              iconTintClassName,
              iconContainerClassName,
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn('font-display text-[28px] font-extrabold leading-none tracking-[-0.5px] text-ink', valueClassName)}>
        {value}
      </p>
      {subtitle ? (
        <p className={cn('mt-1.5 text-[12.5px] font-bold', deltaToneClasses[deltaTone], subtitleClassName)}>{subtitle}</p>
      ) : null}
    </div>
  );
}
