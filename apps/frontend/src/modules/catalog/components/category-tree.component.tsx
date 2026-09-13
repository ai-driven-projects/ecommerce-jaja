'use client';

import { memo } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/class-name.util';
import { catalogCategoryRoute, catalogSubcategoryNewRoute } from '@/shared/navigation/catalog-routes';
import type { CatalogCategory } from '../data/category.api';
import type { CategoryTreeCategoryRow, CategoryTreeRow } from '../data/category.util';

/** Maior nível que ainda oferece "Nova subcategoria" (a hierarquia tem no máximo 3). */
const MAX_PARENT_LEVEL = 2;

/** Recuo por nível, em rem. */
const INDENT_PER_LEVEL_REM = 1.5;

/** Largura do controle expandir/recolher somada ao espaço até o nome, em px. */
const TOGGLE_SPACE_PX = 30;

/** Selo "Destaque" ao lado do nome. */
export function CategoryHighlightBadge() {
  return (
    <Badge variant="brand" className="px-2 py-0.5">
      Destaque
    </Badge>
  );
}

/** Status "Ativa"/"Inativa". */
export function CategoryStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? <Badge variant="success">Ativa</Badge> : <Badge variant="muted">Inativa</Badge>;
}

type CategoryRowActionsProps = {
  category: CatalogCategory;
  /** Query string da lista (página e busca), levada ao formulário para o retorno. */
  listQuery?: string;
  onDelete: (category: CatalogCategory) => void;
};

/** Ações da linha: "Nova subcategoria" (níveis 1 e 2), editar e excluir. */
export function CategoryRowActions({ category, listQuery, onDelete }: CategoryRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {category.level <= MAX_PARENT_LEVEL ? (
        <Button asChild variant="ghost" size="icon-sm">
          <Link
            href={catalogSubcategoryNewRoute(category.id, listQuery)}
            aria-label={`Nova subcategoria em ${category.name}`}
            title="Nova subcategoria"
          >
            <FolderPlus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span className="size-[34px] shrink-0" aria-hidden="true" />
      )}
      <Button asChild variant="ghost" size="icon-sm">
        <Link
          href={catalogCategoryRoute(category.id, listQuery)}
          aria-label={`Editar ${category.name}`}
          title="Editar"
        >
          <Pencil className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:bg-danger-soft hover:text-danger"
        aria-label={`Excluir ${category.name}`}
        title="Excluir"
        onClick={() => onDelete(category)}
      >
        <Trash2 className="size-4" strokeWidth={2.2} aria-hidden="true" />
      </Button>
    </div>
  );
}

function indentStyle(level: number, extraPx = 0) {
  return { paddingLeft: `calc(${(level - 1) * INDENT_PER_LEVEL_REM}rem + ${extraPx}px)` };
}

type CategoryTreeNodeRowProps = {
  row: CategoryTreeCategoryRow;
  listQuery?: string;
  onToggle: (category: CatalogCategory) => void;
  onDelete: (category: CatalogCategory) => void;
};

// Memoizada: abrir um nó ou o diálogo não re-renderiza as linhas que não mudaram.
const CategoryTreeNodeRow = memo(function CategoryTreeNodeRow({
  row,
  listQuery,
  onToggle,
  onDelete,
}: CategoryTreeNodeRowProps) {
  const { node, hasChildren, expanded } = row;

  return (
    <TableRow data-level={node.level}>
      <TableCell>
        <div className="flex min-w-0 items-center gap-1.5" style={indentStyle(node.level)}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node)}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${node.name}`}
              title={expanded ? 'Recolher' : 'Expandir'}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-ink transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ChevronRight
                className={cn('size-4 transition-transform duration-150', expanded && 'rotate-90')}
                strokeWidth={2.4}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="size-6 shrink-0" aria-hidden="true" />
          )}
          <Link
            href={catalogCategoryRoute(node.id, listQuery)}
            className={cn(
              'truncate transition-colors duration-150 hover:text-brand',
              node.level === 1 ? 'font-extrabold' : 'font-semibold',
            )}
          >
            {node.name}
          </Link>
          {node.isHighlighted ? <CategoryHighlightBadge /> : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-ink">{node.slug}</TableCell>
      <TableCell className="tabular-nums text-muted-ink">{node.order}</TableCell>
      <TableCell>
        <CategoryStatusBadge isActive={node.isActive} />
      </TableCell>
      <TableCell align="right" className="font-normal">
        <CategoryRowActions category={node} listQuery={listQuery} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
});

type CategoryTreeProps = {
  /** Linhas visíveis (`flattenCategoryTree`), já com as linhas "Carregando…". */
  rows: CategoryTreeRow[];
  /** Query string da lista (página e busca), levada ao formulário para o retorno. */
  listQuery?: string;
  /** Abre ou fecha um nó com filhas. */
  onToggle: (category: CatalogCategory) => void;
  /** Pede a exclusão; quem chama abre a confirmação. */
  onDelete: (category: CatalogCategory) => void;
};

/**
 * Árvore de categorias em tabela (Nome, Slug, Ordem, Status, Ações): uma linha
 * por categoria visível, recuada pelo nível, com o controle "Expandir/Recolher
 * <nome>" nos nós com filhas, a linha "Carregando…" sob um nó cujas filhas
 * estão chegando (texto estático, sem spinner), selo "Destaque", status e as
 * ações "Nova subcategoria" (níveis 1 e 2), editar e excluir.
 */
export function CategoryTree({ rows, listQuery, onToggle, onDelete }: CategoryTreeProps) {
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
          {rows.map((row) =>
            row.kind === 'loading' ? (
              <TableRow key={`loading-${row.parentId}`} className="hover:bg-transparent">
                <TableCell colSpan={5}>
                  <span
                    role="status"
                    className="block text-[13px] text-muted-ink"
                    style={indentStyle(row.level, TOGGLE_SPACE_PX)}
                  >
                    Carregando…
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              <CategoryTreeNodeRow
                key={row.node.id}
                row={row}
                listQuery={listQuery}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ),
          )}
        </TableBody>
      </Table>
    </TableCard>
  );
}
