'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DeleteConfirmationDialog } from '@/shared/components/ui/delete-confirmation-dialog';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { CATALOG_CATEGORY_NEW_ROUTE } from '@/shared/navigation/catalog-routes';
import { CategoryTree } from '../components/category-tree.component';
import type { CategoryTreeNode } from '../data/category.util';
import { useCategories } from '../data/use-categories.hook';

const HAS_CHILDREN_MESSAGE = 'Exclua ou mova as subcategorias antes de excluir esta categoria.';

// Estrutura estática da tabela (sem shimmer) enquanto a primeira busca responde.
function CategoryTreeSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={`category-skeleton-${index}`}
          className="flex items-center gap-4 border-b border-line py-3 last:border-0"
        >
          <div className={index % 3 === 0 ? 'h-4 w-44 rounded-md bg-surface' : 'ml-8 h-4 w-36 rounded-md bg-surface'} />
          <div className="h-4 w-28 rounded-md bg-surface" />
          <div className="ml-auto h-6 w-16 rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

function countLabel(count: number): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'categoria' : 'categorias'} no catálogo`;
}

/**
 * Árvore de categorias do catálogo: cabeçalho com "Nova categoria", a tabela
 * hierárquica e a confirmação de exclusão, bloqueada para categoria com filhas.
 */
export function CategoriesPage() {
  const { categories, tree, isLoading, remove } = useCategories();

  const [target, setTarget] = useState<CategoryTreeNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Remonta o diálogo a cada abertura para limpar a palavra de confirmação digitada.
  const [dialogKey, setDialogKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const firstLoad = isLoading && categories.length === 0;
  const hasChildren = (target?.children.length ?? 0) > 0;

  // Estável, para não invalidar a memoização das linhas da árvore.
  const openDeleteDialog = useCallback((node: CategoryTreeNode) => {
    setTarget(node);
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

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Categorias"
        subtitle={firstLoad ? 'Carregando categorias…' : countLabel(categories.length)}
        aside={
          <Button asChild size="sm">
            <Link href={CATALOG_CATEGORY_NEW_ROUTE}>
              <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
              Nova categoria
            </Link>
          </Button>
        }
      />

      {firstLoad ? <CategoryTreeSkeleton /> : <CategoryTree tree={tree} onDelete={openDeleteDialog} />}

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
