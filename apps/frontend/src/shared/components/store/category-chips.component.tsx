'use client';

import { cn } from '@/shared/lib/class-name.util';

export type CategoryChip = {
  id: string;
  label: string;
  emoji?: string;
  /** Quantidade de produtos exibida ao lado do rótulo. */
  count?: number;
};

type CategoryChipsProps = {
  categories: CategoryChip[];
  /** `id` do chip ativo; nenhum fica ativo quando não corresponde a um chip. */
  active: string;
  onChange: (categoryId: string) => void;
  /** `sm` para as linhas de subcategorias. */
  size?: 'md' | 'sm';
  /** Rótulo acessível da linha. */
  label?: string;
  className?: string;
};

// Filtros de categoria em pílulas brancas roláveis na horizontal; a ativa fica
// laranja sobre pêssego.
export function CategoryChips({ categories, active, onChange, size = 'md', label = 'Categorias', className }: CategoryChipsProps) {
  return (
    <nav aria-label={label} className={cn('flex gap-2 overflow-x-auto [scrollbar-width:none]', className)}>
      {categories.map((category) => {
        const isActive = category.id === active;

        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(category.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border font-bold transition-colors duration-150',
              size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-[15px] py-2 text-[13.5px]',
              isActive
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-card text-ink hover:border-brand hover:bg-brand-soft hover:text-brand',
            )}
          >
            {category.emoji ? <span aria-hidden="true">{category.emoji}</span> : null}
            {category.label}
            {typeof category.count === 'number' ? (
              <span className={cn('text-xs font-semibold tabular-nums', isActive ? 'text-brand' : 'text-muted-ink')}>
                {category.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
