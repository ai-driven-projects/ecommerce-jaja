'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { EmptyListState } from '@/shared/components/ui/empty-list-state';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/class-name.util';
import { catalogCategoryRoute, catalogSubcategoryNewRoute } from '@/shared/navigation/catalog-routes';
import { flattenCategoryTree, type CategoryTreeNode } from '../data/category.util';

/** Maior nível que ainda oferece "Nova subcategoria" (a hierarquia tem no máximo 3). */
const MAX_PARENT_LEVEL = 2;

/** Recuo por nível, em rem. */
const INDENT_PER_LEVEL_REM = 1.5;

type CategoryTreeProps = {
  tree: CategoryTreeNode[];
  /** Pede a exclusão; quem chama abre a confirmação. */
  onDelete: (node: CategoryTreeNode) => void;
};

type CategoryTreeRowProps = {
  node: CategoryTreeNode;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onDelete: (node: CategoryTreeNode) => void;
};

// Memoizada: recolher um nó ou abrir o diálogo não re-renderiza as ~1,1 mil linhas.
const CategoryTreeRow = memo(function CategoryTreeRow({ node, collapsed, onToggle, onDelete }: CategoryTreeRowProps) {
  const hasChildren = node.children.length > 0;

  return (
    <TableRow data-level={node.level}>
      <TableCell>
        <div
          className="flex min-w-0 items-center gap-1.5"
          style={{ paddingLeft: `${(node.level - 1) * INDENT_PER_LEVEL_REM}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? 'Expandir' : 'Recolher'} ${node.name}`}
              title={collapsed ? 'Expandir' : 'Recolher'}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-ink transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ChevronRight
                className={cn('size-4 transition-transform duration-150', !collapsed && 'rotate-90')}
                strokeWidth={2.4}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden="true" />
          )}
          <Link
            href={catalogCategoryRoute(node.id)}
            className={cn(
              'truncate transition-colors duration-150 hover:text-brand',
              node.level === 1 ? 'font-extrabold' : 'font-semibold',
            )}
          >
            {node.name}
          </Link>
          {node.isHighlighted ? (
            <Badge variant="brand" className="px-2 py-0.5">
              Destaque
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-ink">{node.slug}</TableCell>
      <TableCell className="tabular-nums text-muted-ink">{node.order}</TableCell>
      <TableCell>
        {node.isActive ? <Badge variant="success">Ativa</Badge> : <Badge variant="muted">Inativa</Badge>}
      </TableCell>
      <TableCell align="right" className="font-normal">
        <div className="flex items-center justify-end gap-1">
          {node.level <= MAX_PARENT_LEVEL ? (
            <Button asChild variant="ghost" size="icon-sm">
              <Link
                href={catalogSubcategoryNewRoute(node.id)}
                aria-label={`Nova subcategoria em ${node.name}`}
                title="Nova subcategoria"
              >
                <FolderPlus className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <span className="size-[34px] shrink-0" aria-hidden="true" />
          )}
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={catalogCategoryRoute(node.id)} aria-label={`Editar ${node.name}`} title="Editar">
              <Pencil className="size-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="hover:bg-danger-soft hover:text-danger"
            aria-label={`Excluir ${node.name}`}
            title="Excluir"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

/**
 * Árvore de categorias em tabela: uma linha por categoria, recuada pelo nível,
 * com recolher/expandir nos nós com filhas (estado local, tudo expandido ao
 * abrir), slug, ordem, selo "Destaque", status e as ações "Nova subcategoria"
 * (níveis 1 e 2), editar e excluir.
 */
export function CategoryTree({ tree, onDelete }: CategoryTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());

  const rows = useMemo(() => flattenCategoryTree(tree, collapsedIds), [tree, collapsedIds]);

  const toggle = useCallback((id: string) => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return (
      <EmptyListState
        emoji="🗂️"
        title="Nenhuma categoria cadastrada"
        subtitle="Cadastre o primeiro departamento para organizar os produtos do catálogo."
      />
    );
  }

  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((node) => (
            <CategoryTreeRow
              key={node.id}
              node={node}
              collapsed={collapsedIds.has(node.id)}
              onToggle={toggle}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
