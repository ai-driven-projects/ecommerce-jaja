'use client';

import { useMemo, useState, type Ref } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/class-name.util';

type ComboboxOption = {
  label: string;
  value: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** Id do botão, para associar um `<Label htmlFor>`. */
  id?: string;
  /** Ref do botão, para o formulário focar o campo com erro. */
  ref?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  /** Marca o campo como inválido (`aria-invalid`, borda vermelha). */
  invalid?: boolean;
  onBlur?: () => void;
  /**
   * Busca feita fora do componente (ex.: na API): desliga o filtro local e
   * repassa o texto digitado a cada alteração.
   */
  onSearchChange?: (search: string) => void;
  /** Opção do valor atual quando ela não está em `options` (ex.: página ainda não carregada). */
  selectedOption?: ComboboxOption | null;
  /** Opções sendo carregadas: a lista mostra "Carregando…". */
  loading?: boolean;
  /** Há mais opções a buscar: exibe "Carregar mais" no fim da lista. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadMoreLabel?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecionar...',
  emptyText = 'Nenhum item encontrado.',
  id,
  ref,
  disabled,
  invalid,
  onBlur,
  onSearchChange,
  selectedOption,
  loading = false,
  hasMore = false,
  onLoadMore,
  loadMoreLabel = 'Carregar mais',
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const remoteSearch = onSearchChange !== undefined;

  const selected =
    options.find((option) => option.value === value) ??
    (selectedOption && selectedOption.value === value ? selectedOption : undefined);

  const filtered = useMemo(() => {
    if (remoteSearch) return options;

    const normalized = search.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => [option.label, option.value].join(' ').toLowerCase().includes(normalized));
  }, [options, search, remoteSearch]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid ? true : undefined}
          disabled={disabled}
          onBlur={onBlur}
          className="w-full justify-between aria-invalid:border-danger"
        >
          <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            onSearchChange?.(event.target.value);
          }}
          placeholder={remoteSearch ? 'Buscar...' : 'Filtrar...'}
          className="mb-2"
        />
        <div className="max-h-56 space-y-1 overflow-auto" aria-busy={loading}>
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{loading ? 'Carregando…' : emptyText}</p>
          ) : (
            filtered.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  onChange?.(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between px-2 py-1.5 text-left text-sm transition-colors duration-100 hover:bg-accent',
                  option.value === value && 'bg-accent',
                )}
              >
                <span>{option.label}</span>
                <Check className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
              </button>
            ))
          )}
          {hasMore && onLoadMore && filtered.length > 0 ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className="flex w-full items-center px-2 py-1.5 text-left text-sm font-semibold text-brand transition-colors duration-100 hover:bg-accent disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
            >
              {loading ? 'Carregando…' : loadMoreLabel}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
