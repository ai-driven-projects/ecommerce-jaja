'use client';

import { categoryEmoji } from '@/shared/components/store/category-art';
import { CategoryChips, type CategoryChip } from '@/shared/components/store/category-chips.component';
import type { StorefrontCategory } from '../data/storefront.api';
import { useStorefrontCatalog } from '../data/storefront-catalog.context';
import { categoryTrail } from '../data/storefront-category.util';
import { CATEGORY_ALL } from '../data/storefront.types';
import { useStorefront } from '../data/use-storefront.hook';

// Os chips encostam nas bordas da tela para a rolagem horizontal não cortar no padding.
const EDGE_TO_EDGE = '-mx-4 px-4 sm:-mx-6 sm:px-6';

function subcategoryChips(parent: StorefrontCategory): CategoryChip[] {
  return [
    { id: parent.slug, label: `Tudo em ${parent.name}` },
    ...parent.children.map((child) => ({ id: child.slug, label: child.name, count: child.productCount })),
  ];
}

/** Chips estáticos (blocos creme) enquanto a árvore de categorias carrega. */
export function CategoryChipsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className="h-[37px] w-[132px] shrink-0 rounded-pill bg-surface" />
      ))}
    </div>
  );
}

/**
 * Chips de categoria da vitrine: "Tudo" e as raízes com emoji. Cada categoria
 * da trilha selecionada que tem filhas abre uma linha de subcategorias ("Tudo
 * em <categoria>" e as filhas com a contagem), então selecionar uma neta
 * mantém visíveis as linhas da raiz e do pai, com os chips ativos.
 */
export function StorefrontCategoryNav() {
  const storefront = useStorefront();
  const { categories, loading } = useStorefrontCatalog();

  if (loading) return <CategoryChipsSkeleton />;

  const selected = storefront.category;
  const trail = categoryTrail(categories, selected);
  const rootChips: CategoryChip[] = [
    { id: CATEGORY_ALL, label: 'Tudo', emoji: '🛒' },
    ...categories.map((root) => ({ id: root.slug, label: root.name, emoji: categoryEmoji(root.slug) })),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <CategoryChips
        categories={rootChips}
        active={trail[0]?.slug ?? selected}
        onChange={storefront.setCategory}
        className={EDGE_TO_EDGE}
      />
      {trail.map((node, index) =>
        node.children.length > 0 ? (
          <CategoryChips
            key={node.slug}
            categories={subcategoryChips(node)}
            active={trail[index + 1]?.slug ?? node.slug}
            onChange={storefront.setCategory}
            size="sm"
            label={`Subcategorias de ${node.name}`}
            className={EDGE_TO_EDGE}
          />
        ) : null,
      )}
    </div>
  );
}
