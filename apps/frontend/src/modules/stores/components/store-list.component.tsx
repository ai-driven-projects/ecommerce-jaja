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
import { storeRoute } from '@/shared/navigation/stores-routes';
import { formatPhone } from '@/shared/util/phone.util';
import type { Store } from '../data/store.api';
import { formatRadius } from '../data/store-location.util';

type StoreListProps = {
  stores: Store[];
  /** Query string da lista (página e busca), levada ao formulário para o retorno. */
  listQuery?: string;
  /** Chamado só depois de o administrador confirmar a exclusão. */
  onDelete: (store: Store) => Promise<void> | void;
  emptyTitle?: string;
  emptySubtitle?: string;
};

/** Texto exibido quando a loja não tem endereço ou telefone. */
const EMPTY_VALUE = '—';

/**
 * Tabela de lojas: nome (com o slug abaixo), endereço de referência, telefone
 * formatado, raio de atendimento, status e as ações editar/excluir. A exclusão
 * abre a confirmação e só então chama `onDelete`.
 */
export function StoreList({
  stores,
  listQuery,
  onDelete,
  emptyTitle = 'Nenhuma loja cadastrada',
  emptySubtitle = 'Cadastre a primeira loja com o ponto no mapa e o raio de atendimento.',
}: StoreListProps) {
  const [target, setTarget] = useState<Store | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Remonta o diálogo a cada abertura para limpar a palavra de confirmação digitada.
  const [dialogKey, setDialogKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const openDeleteDialog = (store: Store) => {
    setTarget(store);
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

  if (stores.length === 0) {
    return <EmptyListState emoji="🏬" title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Raio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((store) => (
              <TableRow key={store.id}>
                <TableCell>
                  <Link
                    href={storeRoute(store.id, listQuery)}
                    className="font-bold transition-colors duration-150 hover:text-brand"
                  >
                    {store.name}
                  </Link>
                  <p className="text-xs font-normal text-muted-ink">{store.slug}</p>
                </TableCell>
                <TableCell className="max-w-[280px] text-ink-soft">
                  <span className="line-clamp-2">{store.address || EMPTY_VALUE}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatPhone(store.phone) || EMPTY_VALUE}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatRadius(store.deliveryRadiusMeters)}</TableCell>
                <TableCell>
                  {store.isActive ? <Badge variant="success">Ativa</Badge> : <Badge variant="muted">Inativa</Badge>}
                </TableCell>
                <TableCell align="right" className="font-normal">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link
                        href={storeRoute(store.id, listQuery)}
                        aria-label={`Editar ${store.name}`}
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
                      aria-label={`Excluir ${store.name}`}
                      title="Excluir"
                      onClick={() => openDeleteDialog(store)}
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
        title="Excluir loja"
        description="A loja deixa de aparecer no cadastro. O nome e o slug continuam reservados."
        itemLabel="Loja"
        itemValue={target?.name}
        isConfirming={deleting}
      />
    </>
  );
}
