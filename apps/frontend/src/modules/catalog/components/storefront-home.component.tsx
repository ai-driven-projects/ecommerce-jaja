'use client';

import Link from 'next/link';
import { categoryArt } from '@/shared/components/store/category-art';
import { SectionHeading } from '@/shared/components/store/section-heading.component';
import { cn } from '@/shared/lib/class-name.util';
import type { StorefrontProductFilter } from '../data/storefront.api';
import { useStorefrontCatalog } from '../data/storefront-catalog.context';
import { highlightedCategories } from '../data/storefront-category.util';
import { COURIERS_ONLINE } from '../data/storefront.mock';
import { buildStorefrontHref, storefrontBaseParams, type StorefrontParamChanges } from '../data/storefront-query.util';
import { useStorefront } from '../data/use-storefront.hook';
import { useStorefrontProducts } from '../data/use-storefront-products.hook';
import { StorefrontHero } from './storefront-hero.component';
import { ProductGridSkeleton, StorefrontProductGrid, formatProductCount } from './storefront-product-grid.component';

const FEATURED_ANCHOR = 'em-destaque';
const FEATURED_FILTER: StorefrontProductFilter = { featured: true, sort: 'featured', pageSize: 12 };
const OFFERS_FILTER: StorefrontProductFilter = { onSale: true, sort: 'discount', pageSize: 8 };
const HIGHLIGHTED_CATEGORIES_LIMIT = 12;

type ProductSectionProps = {
  id?: string;
  title: string;
  filter: StorefrontProductFilter;
  /** Filtros da listagem aberta por "Ver tudo →". */
  seeAll: StorefrontParamChanges;
  minCardWidth?: 180 | 220;
  cardSize?: 'md' | 'lg';
  skeletonCount: number;
};

/** Seção de produtos da página inicial; some quando não há itens (ou a API falha). */
function ProductSection({ id, title, filter, seeAll, minCardWidth, cardSize, skeletonCount }: ProductSectionProps) {
  const storefront = useStorefront();
  const products = useStorefrontProducts(filter);

  if (products.data === null && products.loading) {
    return (
      <section id={id} className="scroll-mt-28" aria-busy="true">
        <SectionHeading title={title} />
        <ProductGridSkeleton count={skeletonCount} minCardWidth={minCardWidth} cardSize={cardSize} />
      </section>
    );
  }

  if (products.items.length === 0) return null;

  return (
    <section id={id} className="scroll-mt-28">
      <SectionHeading
        title={title}
        action={{ label: 'Ver tudo', href: buildStorefrontHref(storefrontBaseParams(storefront.params), seeAll) }}
      />
      <StorefrontProductGrid products={products.items} minCardWidth={minCardWidth} cardSize={cardSize} />
    </section>
  );
}

/** Até 12 categorias em destaque (com produtos), com o emoji e o tom da raiz. */
function HighlightedCategories() {
  const storefront = useStorefront();
  const { categories, loading } = useStorefrontCatalog();

  if (loading) {
    return (
      <section aria-busy="true">
        <SectionHeading title="Categorias em destaque" />
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-[74px] rounded-2xl border border-line bg-card p-3">
              <div className="size-12 rounded-xl bg-surface" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const highlighted = highlightedCategories(categories, HIGHLIGHTED_CATEGORIES_LIMIT);
  if (highlighted.length === 0) return null;

  const base = storefrontBaseParams(storefront.params);

  return (
    <section>
      <SectionHeading title="Categorias em destaque" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {highlighted.map(({ category, rootSlug }) => {
          const art = categoryArt(rootSlug);

          return (
            <Link
              key={category.slug}
              href={buildStorefrontHref(base, { category: category.slug })}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-card"
            >
              <span
                aria-hidden="true"
                className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl leading-none', art.tintClass)}
              >
                {art.emoji}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-bold leading-[1.3] text-ink">{category.name}</span>
                <span className="text-[12.5px] tabular-nums text-muted-ink">{formatProductCount(category.productCount)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Página inicial da vitrine (sem busca, sem filtros e categoria "todas"): hero,
 * "Em destaque", "Ofertas da semana" e "Categorias em destaque".
 */
export function StorefrontHome() {
  const storefront = useStorefront();

  return (
    <>
      <StorefrontHero neighborhood={storefront.neighborhood} couriersOnline={COURIERS_ONLINE} ctaHref={`#${FEATURED_ANCHOR}`} />
      <ProductSection
        id={FEATURED_ANCHOR}
        title="Em destaque"
        filter={FEATURED_FILTER}
        seeAll={{ featured: true }}
        skeletonCount={6}
      />
      <ProductSection
        title="Ofertas da semana"
        filter={OFFERS_FILTER}
        seeAll={{ onSale: true, order: 'desconto' }}
        minCardWidth={220}
        cardSize="lg"
        skeletonCount={4}
      />
      <HighlightedCategories />
    </>
  );
}
