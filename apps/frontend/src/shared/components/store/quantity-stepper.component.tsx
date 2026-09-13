'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/class-name.util';

type QuantityStepperProps = {
  quantity: number;
  onChange: (quantity: number) => void;
  /** Menor quantidade permitida (0 remove do carrinho; 1 na página de produto). */
  min?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Nome do item, para os rótulos de acessibilidade. */
  itemName?: string;
  className?: string;
};

const sizeClasses = {
  sm: { wrap: 'gap-0.5 bg-brand-soft p-[3px]', button: 'size-6 [&_svg]:size-3', value: 'min-w-5 text-[13px]' },
  md: { wrap: 'gap-0.5 bg-brand-soft p-[3px]', button: 'size-[26px] [&_svg]:size-3.5', value: 'min-w-[22px] text-sm' },
  lg: { wrap: 'gap-1 bg-surface p-1.5', button: 'size-[38px] [&_svg]:size-4', value: 'min-w-9 text-[17px]' },
} as const;

/** Controle − n + em pílula. O "−" é branco e o "+" é laranja. */
export function QuantityStepper({ quantity, onChange, min = 0, size = 'md', itemName, className }: QuantityStepperProps) {
  const classes = sizeClasses[size];
  const label = itemName ? ` de ${itemName}` : '';

  return (
    <span className={cn('inline-flex items-center rounded-pill', classes.wrap, className)}>
      <button
        type="button"
        aria-label={`Diminuir quantidade${label}`}
        disabled={quantity <= min}
        onClick={() => onChange(Math.max(min, quantity - 1))}
        className={cn(
          'flex items-center justify-center rounded-full bg-card text-brand transition-colors duration-150 hover:bg-brand-pale disabled:opacity-40',
          classes.button,
        )}
      >
        <Minus strokeWidth={3} aria-hidden="true" />
      </button>
      <span aria-live="polite" className={cn('text-center font-extrabold tabular-nums', size === 'lg' ? 'text-ink' : 'text-brand', classes.value)}>
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Aumentar quantidade${label}`}
        onClick={() => onChange(quantity + 1)}
        className={cn(
          'flex items-center justify-center rounded-full bg-brand text-white transition-colors duration-150 hover:bg-brand-strong',
          classes.button,
        )}
      >
        <Plus strokeWidth={3} aria-hidden="true" />
      </button>
    </span>
  );
}

type AddToCartControlProps = {
  quantity: number;
  onChange: (quantity: number) => void;
  itemName: string;
  className?: string;
};

/** Botão "+" redondo quando o item não está no carrinho; vira o stepper depois. */
export function AddToCartControl({ quantity, onChange, itemName, className }: AddToCartControlProps) {
  if (quantity > 0) {
    return <QuantityStepper quantity={quantity} onChange={onChange} size="md" itemName={itemName} className={className} />;
  }

  return (
    <button
      type="button"
      aria-label={`Adicionar ${itemName} ao carrinho`}
      onClick={() => onChange(1)}
      className={cn(
        'flex size-8 items-center justify-center rounded-full border-[1.5px] border-brand bg-card text-brand transition-colors duration-150 hover:bg-brand hover:text-white',
        className,
      )}
    >
      <Plus className="size-4" strokeWidth={3} aria-hidden="true" />
    </button>
  );
}
