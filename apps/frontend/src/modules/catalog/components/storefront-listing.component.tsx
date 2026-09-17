'use client';

import { useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/shared/components/ui/sheet';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import type { StorefrontBrandFacet } from '../data/storefront.api';
import { useStorefrontCatalog } from '../data/storefront-catalog.context';
import { categoryTrail } from '../data/storefront-category.util';
import {
  effectiveOrder,
  hasCatalogFilters,
  toStorefrontProductFilter,
  type StorefrontOrder,
  type StorefrontParamChanges,
  type StorefrontParams,
} from '../data/storefront-query.util';
import { CATEGORY_ALL } from '../data/storefront.types';
import { useStorefront } from '../data/use-storefront.hook';
import { useStorefrontProducts } from '../data/use-storefront-products.hook';
import { StorefrontFilters } from './storefront-filters.component';
import { ProductGridSkeleton, StorefrontProductGrid, formatProductCount } from './storefront-product-grid.component';

/** Itens por página da listagem (o padrão da API). */
export const LISTING_PAGE_SIZE = 24;

const ORDER_OPTIONS: ReadonlyArray<{ value: StorefrontOrder; label: string; searchOnly?: boolean }> = [
  { value: 'relevancia', label: 'Mais relevantes', searchOnly: true },
  { value: 'destaques', label: 'Destaques' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'nome', label: 'Nome (A–Z)' },
  { value: 'desconto', label: 'Maior desconto' },
];

/** "Limpar filtros": marca, preço, só ofertas e só destaques (loja, busca, categoria e ordem ficam). */
const CLEAR_FILTERS: StorefrontParamChanges = {
  brands: [],
  minPriceCents: null,
  maxPriceCents: null,
  onSale: false,
  featured: false,
};

type ActiveFilter = {
  key: string;
  label: string;
  remove: StorefrontParamChanges;
};

function priceLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${formatPrice(min)} a ${formatPrice(max)}`;
  if (min !== null) return `a partir de ${formatPrice(min)}`;
  return `até ${formatPrice(max ?? 0)}`;
}

/** Pílulas dos filtros ativos, cada uma com a mudança que a remove. */
function activeFilters(params: StorefrontParams, facets: StorefrontBrandFacet[]): ActiveFilter[] {
  const filters: ActiveFilter[] = params.brands.map((slug) => ({
    key: `marca-${slug}`,
    label: facets.find((facet) => facet.slug === slug)?.name ?? slug,
    remove: { brands: params.brands.filter((brand) => brand !== slug) },
  }));

  if (params.minPriceCents !== null || params.maxPriceCents !== null) {
    filters.push({
      key: 'preco',
      label: priceLabel(params.minPriceCents, params.maxPriceCents),
      remove: { minPriceCents: null, maxPriceCents: null },
    });
  }
  if (params.onSale) filters.push({ key: 'ofertas', label: 'Só ofertas', remove: { onSale: false } });
  if (params.featured) filters.push({ key: 'destaques', label: 'Só destaques', remove: { featured: false } });

  return filters;
}

function EmptyResults({ canClear, onClear }: { canClear: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <span className="text-[40px] leading-none" aria-hidden="true">
        🔎
      </span>
      <h2 className="mt-2 font-display text-xl font-extrabold tracking-[-0.3px]">
        Nada por aqui. <span className="text-brand">Já já.</span>
      </h2>
      <p className="max-w-md text-sm text-muted-ink">Tente limpar os filtros ou buscar outro termo.</p>
      {canClear ? (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onClear}>
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card px-6 py-12 text-center">
      <span className="text-[40px] leading-none" aria-hidden="true">
        🔌
      </span>
      <h2 className="mt-2 font-display text-xl font-extrabold tracking-[-0.3px]">Não deu para carregar os produtos.</h2>
      <p className="max-w-md text-sm text-muted-ink">{message}</p>
      <Button type="button" className="mt-2" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}

/**
 * Listagem da vitrine (busca, filtros ou categoria), com todo o estado na URL:
 * título por prioridade (busca, categoria com as ancestrais clicáveis,
 * destaques, ofertas) e a contagem; filtros na coluna lateral em `lg` e num
 * painel abaixo disso; ordenação; pílulas dos filtros ativos com "Limpar
 * filtros"; grade sem "+" e paginação que leva ao topo da listagem.
 */
export function StorefrontListing() {
  const storefront = useStorefront();
  const { params } = storefront;
  const { categories, loading: categoriesLoading } = useStorefrontCatalog();
  const topRef = useRef<HTMLElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const products = useStorefrontProducts(toStorefrontProductFilter(params, LISTING_PAGE_SIZE), {
    onPageOutOfRange: (lastPage) => storefront.navigate({ page: lastPage }, { history: 'replace' }),
  });

  const hasCategory = params.category !== CATEGORY_ALL;
  const trail = hasCategory ? categoryTrail(categories, params.category) : [];
  const category = trail.at(-1);
  const filters = activeFilters(params, products.brandFacets);
  const firstLoad = products.data === null && products.loading;

  const title = params.search
    ? `Resultados para “${params.search}”`
    : hasCategory
      ? (category?.name ?? (categoriesLoading ? '…' : 'Produtos'))
      : params.featured
        ? 'Em destaque'
        : params.onSale
          ? 'Ofertas'
          : 'Produtos';
  const ancestors = !params.search && category ? trail.slice(0, -1) : [];

  const changePage = (page: number) => {
    storefront.navigate({ page });
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  const clearFilters = () => storefront.navigate(CLEAR_FILTERS);

  const filterControls = (idPrefix: string) => (
    <StorefrontFilters params={params} facets={products.brandFacets} onChange={storefront.navigate} idPrefix={idPrefix} />
  );

  let content;
  if (products.error) {
    content = <LoadError message={products.error} onRetry={products.reload} />;
  } else if (firstLoad) {
    content = <ProductGridSkeleton count={12} />;
  } else if (products.items.length === 0) {
    content = <EmptyResults canClear={hasCatalogFilters(params)} onClear={clearFilters} />;
  } else {
    content = (
      <div className="flex flex-col gap-6">
        <StorefrontProductGrid products={products.items} />
        {products.totalPages > 1 ? (
          <PaginationControls
            page={params.page}
            totalPages={products.totalPages}
            totalItems={products.total}
            totalLabel="produtos"
            onPageChange={changePage}
          />
        ) : null}
      </div>
    );
  }

  return (
    <section ref={topRef} aria-labelledby="storefront-listing-title" className="scroll-mt-40 md:scroll-mt-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {ancestors.length > 0 ? (
            <nav aria-label="Categorias acima" className="mb-1 flex flex-wrap items-center text-[13px] text-muted-ink">
              {ancestors.map((ancestor) => (
                <span key={ancestor.slug} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => storefront.setCategory(ancestor.slug)}
                    className="font-bold transition-colors duration-150 hover:text-brand"
                  >
                    {ancestor.name}
                  </button>
                  <span className="mx-1.5" aria-hidden="true">
                    /
                  </span>
                </span>
              ))}
            </nav>
          ) : null}
          <h1
            id="storefront-listing-title"
            className="break-words font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.6px] sm:text-[30px]"
          >
            {title}
          </h1>
          <p className="mt-1 text-sm tabular-nums text-muted-ink">{firstLoad ? '…' : formatProductCount(products.total)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" variant="outline" className="lg:hidden" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Filtros ({filters.length})
          </Button>
          <div className="flex items-center gap-2">
            <label htmlFor="storefront-order" className="hidden text-[13px] font-bold text-muted-ink sm:inline">
              Ordenar por
            </label>
            <span className="relative">
              <select
                id="storefront-order"
                value={effectiveOrder(params)}
                onChange={(event) => storefront.navigate({ order: event.target.value as StorefrontOrder })}
                className="h-10 cursor-pointer appearance-none rounded-pill border border-line bg-card pl-4 pr-9 text-sm font-bold text-ink transition-colors duration-150 hover:bg-surface"
              >
                {ORDER_OPTIONS.filter((option) => !option.searchOnly || params.search).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-ink"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </span>
          </div>
        </div>
      </div>

      {filters.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => storefront.navigate(filter.remove)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand bg-brand-soft px-3 py-1.5 text-[13px] font-bold text-brand transition-colors duration-150 hover:bg-brand-pale"
            >
              {filter.label}
              <X className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
              <span className="sr-only">(remover filtro)</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="px-1.5 text-[13px] font-bold text-muted-ink transition-colors duration-150 hover:text-brand"
          >
            Limpar filtros
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Filtros" className="hidden rounded-2xl border border-line bg-card p-5 lg:block">
          {filterControls('filtros-lateral')}
        </aside>

        <div
          aria-busy={products.loading}
          className={cn('min-w-0 transition-opacity duration-150', products.loading && !firstLoad && 'opacity-60')}
        >
          {content}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" aria-describedby={undefined} className="flex flex-col gap-0 p-0">
          <div className="flex items-center justify-between border-b border-line px-[22px] py-5">
            <SheetTitle>Filtros</SheetTitle>
            <SheetClose
              aria-label="Fechar filtros"
              className="flex size-[34px] items-center justify-center rounded-full border border-line bg-card text-muted-ink transition-colors duration-150 hover:bg-surface"
            >
              <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-5">{filterControls('filtros-painel')}</div>
          <div className="flex gap-2.5 border-t border-line px-[22px] pb-5 pt-4">
            {filters.length > 0 ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : null}
            <Button type="button" className="flex-1" onClick={() => setFiltersOpen(false)}>
              {products.loading ? 'Ver produtos' : `Ver ${formatProductCount(products.total)}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
