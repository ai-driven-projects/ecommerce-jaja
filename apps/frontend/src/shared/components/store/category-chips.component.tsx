'use client';

import { cn } from '@/shared/lib/class-name.util';

export type CategoryChip = {
  id: string;
  label: string;
  emoji?: string;
};

type CategoryChipsProps = {
  categories: CategoryChip[];
  active: string;
  onChange: (categoryId: string) => void;
  className?: string;
};

// Filtros de categoria em pílulas brancas; a ativa fica laranja sobre pêssego.
export function CategoryChips({ categories, active, onChange, className }: CategoryChipsProps) {
  return (
    <nav aria-label="Categorias" className={cn('flex gap-2 overflow-x-auto [scrollbar-width:none]', className)}>
      {categories.map((category) => {
        const isActive = category.id === active;

        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(category.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-[15px] py-2 text-[13.5px] font-bold transition-colors duration-150',
              isActive
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line bg-card text-ink hover:border-brand hover:bg-brand-soft hover:text-brand',
            )}
          >
            {category.emoji ? <span aria-hidden="true">{category.emoji}</span> : null}
            {category.label}
          </button>
        );
      })}
    </nav>
  );
}
