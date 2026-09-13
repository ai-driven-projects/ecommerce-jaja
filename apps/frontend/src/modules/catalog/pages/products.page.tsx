'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Combobox } from '@/shared/components/ui/combobox';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { cn } from '@/shared/lib/class-name.util';
import { catalogProductNewRoute } from '@/shared/navigation/catalog-routes';
import { ProductList } from '../components/product-list.component';
import { useProducts } from '../data/use-products.hook';

const ALL_BRANDS_OPTION = { label: 'Todas as marcas', value: '' };
const ALL_CATEGORIES_OPTION = { label: 'Todas as categorias', value: '' };

const STATUS_FILTERS: { label: string; value: boolean | undefined }[] = [
  { label: 'Todos', value: undefined },
  { label: 'Ativos', value: true },
  { label: 'Inativos', value: false },
];

// Estrutura estática da tabela (sem shimmer) enquanto a primeira busca responde.
function ProductListSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={`product-skeleton-${index}`} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          <div className="size-12 rounded-[10px] bg-surface" />
          <div className="h-4 w-56 rounded-md bg-surface" />
          <div className="h-4 w-16 rounded-md bg-surface" />
          <div className="h-4 w-24 rounded-md bg-surface" />
          <div className="ml-auto h-4 w-20 rounded-md bg-surface" />
          <div className="h-6 w-16 rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** Estrutura da listagem enquanto a página e os filtros da URL são resolvidos (fallback do `<Suspense>`). */
export function ProductsPageSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 rounded-md bg-surface" />
        <div className="h-4 w-56 rounded-md bg-surface" />
      </div>
      <div className="flex flex-col gap-2.5 lg:flex-row">
        <div className="h-[42px] w-full rounded-pill bg-surface lg:max-w-sm" />
        <div className="h-10 w-full rounded-pill bg-surface lg:w-56" />
        <div className="h-10 w-full rounded-pill bg-surface lg:w-72" />
      </div>
      <ProductListSkeleton />
    </div>
  );
}

function countLabel(total: number, filtered: boolean): string {
  const noun = total === 1 ? 'produto' : 'produtos';
  if (filtered) return `${total} ${noun} ${total === 1 ? 'encontrado' : 'encontrados'}`;
  return `${total} ${noun} no catálogo`;
}

/**
 * Lista de produtos do catálogo: cabeçalho com "Novo produto", busca, filtros
 * de marca, categoria (pelo caminho) e status refletidos na URL, a tabela e a
 * paginação. Precisa estar dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function ProductsPage() {
  const {
    products,
    total,
    totalPages,
    page,
    loading,
    firstLoad,
    searchInput,
    setSearchInput,
    brandId,
    categoryId,
    isActive,
    hasFilters,
    brandSelect,
    categoryOptions,
    listQuery,
    setFilter,
    setPage,
    clearFilters,
    remove,
  } = useProducts();

  // "Todas as marcas" só aparece sem busca no seletor; com busca, só as marcas encontradas.
  const brandFilterOptions = useMemo(
    () => (brandSelect.search.trim() ? brandSelect.options : [ALL_BRANDS_OPTION, ...brandSelect.options]),
    [brandSelect.search, brandSelect.options],
  );
  const categoryFilterOptions = useMemo(() => [ALL_CATEGORIES_OPTION, ...categoryOptions], [categoryOptions]);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Produtos"
        subtitle={firstLoad ? 'Carregando produtos…' : countLabel(total, hasFilters)}
        aside={
          <Button asChild size="sm">
            <Link href={catalogProductNewRoute(listQuery)}>
              <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Novo produto
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <div
          role="search"
          className="flex w-full items-center gap-2.5 rounded-pill border border-line bg-surface px-[18px] transition-colors duration-150 focus-within:border-brand lg:max-w-sm"
        >
          <Search className="size-[17px] shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Buscar produtos por nome, slug ou SKU"
            placeholder="Buscar por nome, slug ou SKU…"
            autoComplete="off"
            className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
          />
        </div>

        <div className="w-full lg:w-56">
          <Combobox
            options={brandFilterOptions}
            value={brandId}
            onChange={(value) => setFilter({ brandId: value })}
            placeholder="Todas as marcas"
            emptyText="Nenhuma marca encontrada."
            onSearchChange={brandSelect.setSearch}
            selectedOption={brandSelect.selectedOption}
            loading={brandSelect.loading}
            hasMore={brandSelect.hasMore}
            onLoadMore={brandSelect.loadMore}
          />
        </div>

        <div className="w-full lg:w-72">
          <Combobox
            options={categoryFilterOptions}
            value={categoryId}
            onChange={(value) => setFilter({ categoryId: value })}
            placeholder="Todas as categorias"
            emptyText="Nenhuma categoria encontrada."
          />
        </div>

        <div role="group" aria-label="Filtrar por status" className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((option) => {
            const active = isActive === option.value;

            return (
              <Button
                key={option.label}
                type="button"
                size="sm"
                variant={active ? 'soft' : 'outline'}
                aria-pressed={active}
                className={cn(active && 'border border-brand-pale')}
                onClick={() => setFilter({ isActive: option.value })}
              >
                {option.label}
              </Button>
            );
          })}
        </div>

        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {firstLoad ? (
        <ProductListSkeleton />
      ) : (
        <div className={cn('flex flex-col gap-4', loading && 'opacity-60')} aria-busy={loading}>
          <ProductList
            products={products}
            listQuery={listQuery}
            onDelete={(product) => remove(product.id)}
            emptyTitle={hasFilters ? 'Nenhum produto encontrado' : undefined}
            emptySubtitle={hasFilters ? 'Nenhum produto corresponde à busca e aos filtros aplicados.' : undefined}
          />

          {total > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              totalLabel="produtos"
              onPageChange={setPage}
              disabled={loading}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
