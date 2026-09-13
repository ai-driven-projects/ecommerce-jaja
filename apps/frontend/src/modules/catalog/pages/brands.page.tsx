'use client';

import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { cn } from '@/shared/lib/class-name.util';
import { catalogBrandNewRoute } from '@/shared/navigation/catalog-routes';
import { BrandList } from '../components/brand-list.component';
import { useBrands } from '../data/use-brands.hook';

// Estrutura estática da tabela (sem shimmer) enquanto a primeira busca responde.
function BrandListSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`brand-skeleton-${index}`} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          <div className="size-10 rounded-[10px] bg-surface" />
          <div className="h-4 w-40 rounded-md bg-surface" />
          <div className="h-4 w-28 rounded-md bg-surface" />
          <div className="ml-auto h-6 w-16 rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** Estrutura da lista enquanto a página e a busca da URL são resolvidas (fallback do `<Suspense>`). */
export function BrandsPageSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-32 rounded-md bg-surface" />
        <div className="h-4 w-48 rounded-md bg-surface" />
      </div>
      <div className="h-[42px] w-full max-w-md rounded-pill bg-surface" />
      <BrandListSkeleton />
    </div>
  );
}

function countLabel(total: number, searching: boolean): string {
  const noun = total === 1 ? 'marca' : 'marcas';
  if (searching) return `${total} ${noun} ${total === 1 ? 'encontrada' : 'encontradas'}`;
  return `${total} ${noun} no catálogo`;
}

/**
 * Lista de marcas do catálogo: cabeçalho com "Nova marca", busca por nome ou
 * descrição, a tabela com as ações e a paginação, com página e busca na URL.
 * Precisa estar dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function BrandsPage() {
  const {
    brands,
    total,
    totalPages,
    page,
    loading,
    firstLoad,
    search,
    searchInput,
    setSearchInput,
    listQuery,
    setPage,
    remove,
  } = useBrands();
  const searching = search !== '';

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Marcas"
        subtitle={firstLoad ? 'Carregando marcas…' : countLabel(total, searching)}
        aside={
          <Button asChild size="sm">
            <Link href={catalogBrandNewRoute(listQuery)}>
              <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Nova marca
            </Link>
          </Button>
        }
      />

      <div
        role="search"
        className="flex w-full max-w-md items-center gap-2.5 rounded-pill border border-line bg-surface px-[18px] transition-colors duration-150 focus-within:border-brand"
      >
        <Search className="size-[17px] shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Buscar marcas por nome ou descrição"
          placeholder="Buscar por nome ou descrição…"
          autoComplete="off"
          className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
        />
      </div>

      {firstLoad ? (
        <BrandListSkeleton />
      ) : (
        <div className={cn('flex flex-col gap-4', loading && 'opacity-60')} aria-busy={loading}>
          <BrandList
            brands={brands}
            listQuery={listQuery}
            onDelete={(brand) => remove(brand.id)}
            emptyTitle={searching ? 'Nenhuma marca encontrada' : undefined}
            emptySubtitle={searching ? `Nenhuma marca corresponde a "${search}" no nome ou na descrição.` : undefined}
          />

          {total > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              totalLabel="marcas"
              onPageChange={setPage}
              disabled={loading}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
