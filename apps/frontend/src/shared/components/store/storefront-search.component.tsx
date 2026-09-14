'use client';

import { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/class-name.util';

type StorefrontSearchProps = {
  /** Termo inicial (o da URL). Use `key` com o mesmo valor para o campo acompanhar a URL. */
  defaultValue?: string;
  /** Envio com Enter ou pela lupa, com o termo sem espaços nas pontas (vazio remove a busca). */
  onSearch?: (term: string) => void;
  className?: string;
};

// Campo de busca em pílula creme: a lupa envia, o "×" limpa o texto.
export function StorefrontSearch({ defaultValue = '', onSearch, className }: StorefrontSearchProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch?.(value.trim());
      }}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-pill border border-line bg-surface pl-2 pr-2 transition-colors duration-150 focus-within:border-brand',
        className,
      )}
    >
      <button
        type="submit"
        aria-label="Buscar"
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-muted-ink transition-colors duration-150 hover:text-brand"
      >
        <Search className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Buscar produtos"
        placeholder="Buscar papel A4, toner, café…"
        autoComplete="off"
        enterKeyHint="search"
        className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => {
            setValue('');
            inputRef.current?.focus();
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-ink transition-colors duration-150 hover:bg-surface-strong hover:text-ink"
        >
          <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}
