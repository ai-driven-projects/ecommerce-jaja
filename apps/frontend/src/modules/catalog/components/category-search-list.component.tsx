'use client';

import Link from 'next/link';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { catalogCategoryRoute } from '@/shared/navigation/catalog-routes';
import type { CatalogCategory } from '../data/category.api';
import { CategoryHighlightBadge, CategoryRowActions, CategoryStatusBadge } from './category-tree.component';

type CategorySearchListProps = {
  categories: CatalogCategory[];
  /** Query string da lista (página e busca), levada ao formulário para o retorno. */
  listQuery?: string;
  /** Pede a exclusão; quem chama abre a confirmação. */
  onDelete: (category: CatalogCategory) => void;
};

/** Caminho com os ancestrais em cinza e o nome da própria categoria em negrito. */
function CategoryPath({ category }: { category: CatalogCategory }) {
  const suffix = ` / ${category.name}`;
  const ancestors = category.level > 1 && category.path.endsWith(suffix) ? category.path.slice(0, -suffix.length) : '';

  return (
    <>
      {ancestors ? <span className="text-muted-ink">{ancestors} / </span> : null}
      <span className="font-bold">{category.name}</span>
    </>
  );
}

/**
 * Resultado da busca de categorias em tabela plana (Caminho, Slug, Ordem,
 * Status, Ações): uma linha por categoria encontrada em qualquer nível, com o
 * caminho completo, selo "Destaque", status e as mesmas ações da árvore.
 */
export function CategorySearchList({ categories, listQuery, onDelete }: CategorySearchListProps) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Caminho</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id} data-level={category.level}>
              <TableCell>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <Link
                    href={catalogCategoryRoute(category.id, listQuery)}
                    className="transition-colors duration-150 hover:text-brand"
                  >
                    <CategoryPath category={category} />
                  </Link>
                  {category.isHighlighted ? <CategoryHighlightBadge /> : null}
                </div>
              </TableCell>
              <TableCell className="text-muted-ink">{category.slug}</TableCell>
              <TableCell className="tabular-nums text-muted-ink">{category.order}</TableCell>
              <TableCell>
                <CategoryStatusBadge isActive={category.isActive} />
              </TableCell>
              <TableCell align="right" className="font-normal">
                <CategoryRowActions category={category} listQuery={listQuery} onDelete={onDelete} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
