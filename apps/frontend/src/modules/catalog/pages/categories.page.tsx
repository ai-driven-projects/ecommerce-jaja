'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ChevronsDownUp, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DeleteConfirmationDialog } from '@/shared/components/ui/delete-confirmation-dialog';
import { EmptyListState } from '@/shared/components/ui/empty-list-state';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { cn } from '@/shared/lib/class-name.util';
import { catalogCategoryNewRoute } from '@/shared/navigation/catalog-routes';
import { CategorySearchList } from '../components/category-search-list.component';
import { CategoryTree } from '../components/category-tree.component';
import type { CatalogCategory } from '../data/category.api';
import { useCategories, type CategoriesMode } from '../data/use-categories.hook';

const HAS_CHILDREN_MESSAGE = 'Exclua ou mova as subcategorias antes de excluir esta categoria.';

// Estrutura estática da tabela (sem shimmer nem spinner) enquanto a primeira busca responde.
function CategoryTableSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={`category-skeleton-${index}`} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          <div className="h-4 w-44 rounded-md bg-surface" />
          <div className="h-4 w-28 rounded-md bg-surface" />
          <div className="h-4 w-8 rounded-md bg-surface" />
          <div className="ml-auto h-6 w-16 rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** Estrutura da lista enquanto a página e a busca da URL são resolvidas (fallback do `<Suspense>`). */
export function CategoriesPageSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-36 rounded-md bg-surface" />
        <div className="h-4 w-56 rounded-md bg-surface" />
      </div>
      <div className="h-[42px] w-full max-w-md rounded-pill bg-surface" />
      <CategoryTableSkeleton />
    </div>
  );
}

function countLabel(total: number, mode: CategoriesMode): string {
  if (mode === 'search') {
    return `${total} ${total === 1 ? 'categoria encontrada' : 'categorias encontradas'}`;
  }
  return `${total} ${total === 1 ? 'departamento' : 'departamentos'} no catálogo`;
}

/**
 * Lista de categorias do catálogo. Sem busca, a árvore paginada por
 * departamento, com o botão "Expandir tudo"/"Recolher tudo" (preferência
 * guardada no navegador); com busca, a lista plana das categorias encontradas.
 * Página e busca ficam na URL. A exclusão pede confirmação e fica bloqueada
 * para categoria com filhas. Precisa estar dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function CategoriesPage() {
  const {
    mode,
    shownMode,
    rows,
    categories,
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
    expanded,
    setExpanded,
    toggleNode,
    remove,
  } = useCategories();

  const [target, setTarget] = useState<CatalogCategory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Remonta o diálogo a cada abertura para limpar a palavra de confirmação digitada.
  const [dialogKey, setDialogKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const hasChildren = (target?.childrenCount ?? 0) > 0;

  // Estável, para não invalidar a memoização das linhas da árvore.
  const openDeleteDialog = useCallback((category: CatalogCategory) => {
    setTarget(category);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!deleting) setDialogOpen(open);
  };

  const handleConfirm = async () => {
    if (!target || hasChildren) return;

    setDeleting(true);
    try {
      await remove(target.id);
    } finally {
      setDeleting(false);
      setDialogOpen(false);
    }
  };

  const isEmpty = shownMode === 'tree' ? rows.length === 0 : categories.length === 0;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Categorias"
        subtitle={firstLoad ? 'Carregando categorias…' : countLabel(total, shownMode)}
        aside={
          <>
            {mode === 'tree' ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
                {expanded ? (
                  <ChevronsDownUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <ChevronsUpDown className="size-4" strokeWidth={2.4} aria-hidden="true" />
                )}
                {expanded ? 'Recolher tudo' : 'Expandir tudo'}
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link href={catalogCategoryNewRoute(listQuery)}>
                <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
                Nova categoria
              </Link>
            </Button>
          </>
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
          aria-label="Buscar categorias por nome, slug ou descrição"
          placeholder="Buscar por nome, slug ou descrição…"
          autoComplete="off"
          className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
        />
      </div>

      {firstLoad ? (
        <CategoryTableSkeleton />
      ) : (
        <div className={cn('flex flex-col gap-4', loading && 'opacity-60')} aria-busy={loading}>
          {isEmpty ? (
            shownMode === 'tree' ? (
              <EmptyListState
                emoji="🗂️"
                title="Nenhuma categoria cadastrada"
                subtitle="Cadastre o primeiro departamento para organizar os produtos do catálogo."
              />
            ) : (
              <EmptyListState
                emoji="🔎"
                title="Nenhuma categoria encontrada"
                subtitle={`Nenhuma categoria corresponde a "${search}" no nome, no slug ou na descrição.`}
              />
            )
          ) : shownMode === 'tree' ? (
            <CategoryTree rows={rows} listQuery={listQuery} onToggle={toggleNode} onDelete={openDeleteDialog} />
          ) : (
            <CategorySearchList categories={categories} listQuery={listQuery} onDelete={openDeleteDialog} />
          )}

          {total > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              totalLabel={shownMode === 'tree' ? 'departamentos' : 'categorias'}
              onPageChange={setPage}
              disabled={loading}
            />
          ) : null}
        </div>
      )}

      <DeleteConfirmationDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        title="Excluir categoria"
        description="A categoria deixa de aparecer no catálogo. O slug continua reservado."
        itemLabel="Categoria"
        itemValue={target?.path}
        isConfirming={deleting}
        confirmDisabled={hasChildren}
        confirmDisabledMessage={hasChildren ? HAS_CHILDREN_MESSAGE : undefined}
      />
    </div>
  );
}
