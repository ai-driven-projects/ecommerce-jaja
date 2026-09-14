'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DeleteConfirmationDialog } from '@/shared/components/ui/delete-confirmation-dialog';
import { EmptyListState } from '@/shared/components/ui/empty-list-state';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { catalogProductRoute } from '@/shared/navigation/catalog-routes';
import { formatPrice } from '@/shared/util/price.util';
import type { CatalogProductListItem } from '../data/product.api';
import { ProductThumbnail } from './product-thumbnail.component';

type ProductListProps = {
  products: CatalogProductListItem[];
  /** Query string atual da lista (sem `?`), levada ao formulário para o retorno à mesma página. */
  listQuery: string;
  /** Chamado só depois de o administrador confirmar a exclusão. */
  onDelete: (product: CatalogProductListItem) => Promise<void> | void;
  emptyTitle?: string;
  emptySubtitle?: string;
};

/**
 * Tabela de produtos: miniatura (ou placeholder), nome, sku, marca, categoria
 * pelo caminho completo, preço (com o "De:" riscado ao lado), status e as ações
 * editar/excluir. A exclusão abre a confirmação e só então chama `onDelete`.
 */
export function ProductList({
  products,
  listQuery,
  onDelete,
  emptyTitle = 'Nenhum produto cadastrado',
  emptySubtitle = 'Cadastre o primeiro produto para montar o catálogo.',
}: ProductListProps) {
  const [target, setTarget] = useState<CatalogProductListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Remonta o diálogo a cada abertura para limpar a palavra de confirmação digitada.
  const [dialogKey, setDialogKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const openDeleteDialog = (product: CatalogProductListItem) => {
    setTarget(product);
    setDialogKey((key) => key + 1);
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!deleting) setDialogOpen(open);
  };

  const handleConfirm = async () => {
    if (!target) return;

    setDeleting(true);
    try {
      await onDelete(target);
    } finally {
      setDeleting(false);
      setDialogOpen(false);
    }
  };

  if (products.length === 0) {
    return <EmptyListState emoji="📦" title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Imagem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead align="right">Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const editHref = catalogProductRoute(product.id, listQuery);

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <ProductThumbnail url={product.mainImageUrl} name={product.name} />
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-[220px] max-w-[420px] items-start gap-2">
                      <Link
                        href={editHref}
                        title={product.name}
                        className="line-clamp-2 max-w-[360px] font-bold transition-colors duration-150 hover:text-brand"
                      >
                        {product.name}
                      </Link>
                      {product.isFeatured ? (
                        <Badge variant="brand" className="shrink-0 px-2 py-0.5">
                          Destaque
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-ink">{product.sku ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink-soft">{product.brandName ?? '—'}</TableCell>
                  <TableCell className="min-w-[180px] text-muted-ink">{product.categoryPath}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap">
                    <div className="flex items-baseline justify-end gap-2">
                      <span
                        className={
                          product.listPriceCents !== null
                            ? 'font-extrabold tabular-nums text-brand'
                            : 'font-extrabold tabular-nums text-ink'
                        }
                      >
                        {formatPrice(product.priceCents)}
                      </span>
                      {product.listPriceCents !== null ? (
                        <s className="text-xs font-semibold tabular-nums text-placeholder">
                          {formatPrice(product.listPriceCents)}
                        </s>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
                  </TableCell>
                  <TableCell align="right" className="font-normal">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link href={editHref} aria-label={`Editar ${product.name}`} title="Editar">
                          <Pencil className="size-4" strokeWidth={2.2} aria-hidden="true" />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="hover:bg-danger-soft hover:text-danger"
                        aria-label={`Excluir ${product.name}`}
                        title="Excluir"
                        onClick={() => openDeleteDialog(product)}
                      >
                        <Trash2 className="size-4" strokeWidth={2.2} aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard>

      <DeleteConfirmationDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        title="Excluir produto"
        description="O produto deixa de aparecer no catálogo. O slug e o SKU continuam reservados."
        itemLabel="Produto"
        itemValue={target?.name}
        isConfirming={deleting}
      />
    </>
  );
}
