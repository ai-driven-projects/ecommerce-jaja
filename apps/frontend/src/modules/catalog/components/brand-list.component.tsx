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
import { catalogBrandRoute } from '@/shared/navigation/catalog-routes';
import type { Brand } from '../data/brand.api';
import { BrandLogo } from './brand-logo.component';

type BrandListProps = {
  brands: Brand[];
  /** Query string da lista (página e busca), levada ao formulário para o retorno. */
  listQuery?: string;
  /** Chamado só depois de o administrador confirmar a exclusão. */
  onDelete: (brand: Brand) => Promise<void> | void;
  emptyTitle?: string;
  emptySubtitle?: string;
};

/**
 * Tabela de marcas: logo (ou placeholder), nome, slug, status e as ações
 * editar/excluir. A exclusão abre a confirmação e só então chama `onDelete`.
 */
export function BrandList({
  brands,
  listQuery,
  onDelete,
  emptyTitle = 'Nenhuma marca cadastrada',
  emptySubtitle = 'Cadastre a primeira marca para usá-la nos produtos do catálogo.',
}: BrandListProps) {
  const [target, setTarget] = useState<Brand | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Remonta o diálogo a cada abertura para limpar a palavra de confirmação digitada.
  const [dialogKey, setDialogKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const openDeleteDialog = (brand: Brand) => {
    setTarget(brand);
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

  if (brands.length === 0) {
    return <EmptyListState emoji="🏷️" title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Logo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => (
              <TableRow key={brand.id}>
                <TableCell>
                  <BrandLogo url={brand.logoUrl} name={brand.name} />
                </TableCell>
                <TableCell>
                  <Link
                    href={catalogBrandRoute(brand.id, listQuery)}
                    className="font-bold transition-colors duration-150 hover:text-brand"
                  >
                    {brand.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-ink">{brand.slug}</TableCell>
                <TableCell>
                  {brand.isActive ? <Badge variant="success">Ativa</Badge> : <Badge variant="muted">Inativa</Badge>}
                </TableCell>
                <TableCell align="right" className="font-normal">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link
                        href={catalogBrandRoute(brand.id, listQuery)}
                        aria-label={`Editar ${brand.name}`}
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
                      aria-label={`Excluir ${brand.name}`}
                      title="Excluir"
                      onClick={() => openDeleteDialog(brand)}
                    >
                      <Trash2 className="size-4" strokeWidth={2.2} aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>

      <DeleteConfirmationDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirm}
        title="Excluir marca"
        description="A marca deixa de aparecer no catálogo. O nome e o slug continuam reservados."
        itemLabel="Marca"
        itemValue={target?.name}
        isConfirming={deleting}
      />
    </>
  );
}
