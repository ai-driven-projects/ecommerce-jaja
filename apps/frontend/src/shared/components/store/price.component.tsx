import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';

type PriceProps = {
  cents: number;
  /** Preço anterior riscado (ofertas). */
  oldCents?: number | null;
  className?: string;
  oldClassName?: string;
};

/** Preço em negrito, no formato `R$ 12,90`; em oferta, o atual fica laranja e o antigo riscado. */
export function Price({ cents, oldCents, className, oldClassName }: PriceProps) {
  const hasOld = typeof oldCents === 'number' && oldCents > cents;

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      {hasOld ? (
        <s className={cn('text-[12.5px] font-semibold text-placeholder no-underline line-through', oldClassName)}>
          {formatPrice(oldCents)}
        </s>
      ) : null}
      <span className={cn('font-extrabold tabular-nums', hasOld && 'text-brand')}>{formatPrice(cents)}</span>
    </span>
  );
}
