'use client';

import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/class-name.util';

type StorefrontSearchProps = {
  className?: string;
};

// Campo de busca em pílula creme. A pesquisa ainda não está implementada:
// o campo aceita digitação, mas o envio não faz nada.
export function StorefrontSearch({ className }: StorefrontSearchProps) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-pill border border-line bg-surface px-[18px] transition-colors duration-150 focus-within:border-brand',
        className,
      )}
    >
      <Search className="size-[17px] shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
      <input
        type="search"
        name="q"
        aria-label="Buscar produtos"
        placeholder="Buscar papel A4, toner, café…"
        autoComplete="off"
        className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
      />
    </form>
  );
}
