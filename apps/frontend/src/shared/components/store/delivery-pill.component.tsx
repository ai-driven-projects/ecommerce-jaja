'use client';

import { Check, ChevronDown, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/class-name.util';

type DeliveryPillProps = {
  neighborhood: string;
  neighborhoods: string[];
  /** ETA do bairro atual; `null` quando o bairro não é atendido. */
  etaMinutes: number | null;
  onNeighborhoodChange: (neighborhood: string) => void;
  className?: string;
};

// Pílula creme com relógio verde: "Entrega em ~25 min · Bela Vista". Abre um
// menu para trocar o bairro de entrega.
export function DeliveryPill({ neighborhood, neighborhoods, etaMinutes, onNeighborhoodChange, className }: DeliveryPillProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Bairro de entrega: ${neighborhood}. Trocar bairro`}
          className={cn(
            'flex min-w-0 items-center gap-2 rounded-pill border border-line bg-surface px-4 py-[9px] text-sm text-ink transition-colors duration-150 hover:bg-surface-strong',
            className,
          )}
        >
          <Clock className={cn('size-4 shrink-0', etaMinutes === null ? 'text-muted-ink' : 'text-success')} strokeWidth={2.2} aria-hidden="true" />
          <span className="truncate">
            {etaMinutes === null ? (
              <strong className="text-muted-ink">Ainda não atendemos</strong>
            ) : (
              <strong className="text-brand">Entrega em ~{etaMinutes} min</strong>
            )}
            <span className="text-muted-ink"> · {neighborhood}</span>
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-ink" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Entregar em</DropdownMenuLabel>
        {neighborhoods.map((option) => {
          const isActive = option === neighborhood;
          return (
            <DropdownMenuItem
              key={option}
              onSelect={() => onNeighborhoodChange(option)}
              className={cn('justify-between', isActive && 'text-brand')}
            >
              {option}
              {isActive ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
