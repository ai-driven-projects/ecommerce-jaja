'use client';

import { Check, ChevronDown, Store } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { StoreOption } from '@/shared/components/store/store.types';
import { cn } from '@/shared/lib/class-name.util';

/** Texto da pílula enquanto as lojas ainda não chegaram (o mesmo do esqueleto do cabeçalho). */
export const STORE_PICKER_PLACEHOLDER = 'Escolha a loja';

const PILL_CLASS =
  'flex min-w-0 items-center gap-2 rounded-pill border border-line bg-surface px-4 py-[9px] text-sm text-ink';

type StorePickerProps = {
  /** Loja em vigor; `null` enquanto as lojas carregam ou sem nenhuma loja ativa. */
  store: StoreOption | null;
  /** Lojas ativas disponíveis para troca, na ordem da API. */
  stores: StoreOption[];
  onStoreChange: (slug: string) => void;
  className?: string;
};

/** "São Paulo/SP"; `null` quando o endereço da loja não traz cidade e UF. */
function placeOf(store: StoreOption): string | null {
  return store.city && store.state ? `${store.city}/${store.state}` : null;
}

// Pílula creme com o ícone de loja: nome da loja em vigor e, quando conhecida,
// a cidade/UF dela. Abre o menu das lojas ativas, com a atual marcada. Não fala
// de tempo de entrega: não existe cálculo real nesta versão.
export function StorePicker({ store, stores, onStoreChange, className }: StorePickerProps) {
  const icon = <Store className="size-4 shrink-0 text-brand" strokeWidth={2.2} aria-hidden="true" />;

  // Sem loja (carregando ou nenhuma ativa) e com uma só loja: pílula estática,
  // sem menu, mantendo a mesma caixa para o cabeçalho não pular.
  if (store === null || stores.length < 2) {
    return (
      <span className={cn(PILL_CLASS, className)}>
        {icon}
        {store === null ? (
          <span className="truncate text-placeholder">{STORE_PICKER_PLACEHOLDER}</span>
        ) : (
          <span className="truncate">
            <strong className="text-brand">{store.name}</strong>
            {placeOf(store) ? <span className="text-muted-ink"> · {placeOf(store)}</span> : null}
          </span>
        )}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Loja escolhida: ${store.name}. Trocar de loja`}
          className={cn(PILL_CLASS, 'transition-colors duration-150 hover:bg-surface-strong', className)}
        >
          {icon}
          <span className="truncate">
            <strong className="text-brand">{store.name}</strong>
            {placeOf(store) ? <span className="text-muted-ink"> · {placeOf(store)}</span> : null}
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-ink" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Comprar na loja</DropdownMenuLabel>
        {stores.map((option) => {
          const isActive = option.slug === store.slug;
          const place = placeOf(option);

          return (
            <DropdownMenuItem
              key={option.slug}
              onSelect={() => onStoreChange(option.slug)}
              className={cn('justify-between gap-3', isActive && 'text-brand')}
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{option.name}</span>
                {place ? <span className="block truncate text-xs text-muted-ink">{place}</span> : null}
              </span>
              {isActive ? <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
