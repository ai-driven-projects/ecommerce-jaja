'use client';

import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { cn } from '@/shared/lib/class-name.util';
import { storeNewRoute } from '@/shared/navigation/stores-routes';
import { StoreList } from '../components/store-list.component';
import { useStores } from '../data/use-stores.hook';

// Estrutura estática da tabela (sem shimmer) enquanto a primeira busca responde.
function StoreListSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`store-skeleton-${index}`} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-36 rounded-md bg-surface" />
            <div className="h-3 w-24 rounded-md bg-surface" />
          </div>
          <div className="h-4 w-48 rounded-md bg-surface" />
          <div className="h-4 w-28 rounded-md bg-surface" />
          <div className="h-4 w-14 rounded-md bg-surface" />
          <div className="ml-auto h-6 w-16 rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** Estrutura da lista enquanto a página e a busca da URL são resolvidas (fallback do `<Suspense>`). */
export function StoresPageSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-32 rounded-md bg-surface" />
        <div className="h-4 w-48 rounded-md bg-surface" />
      </div>
      <div className="h-[42px] w-full max-w-md rounded-pill bg-surface" />
      <StoreListSkeleton />
    </div>
  );
}

function countLabel(total: number, searching: boolean): string {
  const noun = total === 1 ? 'loja' : 'lojas';
  if (searching) return `${total} ${noun} ${total === 1 ? 'encontrada' : 'encontradas'}`;
  return `${total} ${noun} ${total === 1 ? 'cadastrada' : 'cadastradas'}`;
}

/**
 * Lista de lojas: cabeçalho com "Nova loja", busca por nome, slug ou endereço,
 * a tabela com as ações e a paginação, com página e busca na URL. Precisa
 * estar dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function StoresPage() {
  const {
    stores,
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
  } = useStores();
  const searching = search !== '';

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Lojas"
        subtitle={firstLoad ? 'Carregando lojas…' : countLabel(total, searching)}
        aside={
          <Button asChild size="sm">
            <Link href={storeNewRoute(listQuery)}>
              <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Nova loja
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
          aria-label="Buscar lojas por nome, slug ou endereço"
          placeholder="Buscar por nome, slug ou endereço…"
          autoComplete="off"
          className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
        />
      </div>

      {firstLoad ? (
        <StoreListSkeleton />
      ) : (
        <div className={cn('flex flex-col gap-4', loading && 'opacity-60')} aria-busy={loading}>
          <StoreList
            stores={stores}
            listQuery={listQuery}
            onDelete={(store) => remove(store.id)}
            emptyTitle={searching ? 'Nenhuma loja encontrada' : undefined}
            emptySubtitle={
              searching ? `Nenhuma loja corresponde a "${search}" no nome, no slug ou no endereço.` : undefined
            }
          />

          {total > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              totalLabel="lojas"
              onPageChange={setPage}
              disabled={loading}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
