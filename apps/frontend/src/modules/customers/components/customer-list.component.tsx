'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { EmptyListState } from '@/shared/components/ui/empty-list-state';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { customerRoute } from '@/shared/navigation/customers-routes';
import type { CustomerListItem } from '../data/customer.api';
import { formatCpf, formatPhone } from '../data/customer.util';

type CustomerListProps = {
  customers: CustomerListItem[];
  /** Query string da lista (página, busca e status), levada ao formulário para o retorno. */
  listQuery?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
};

/**
 * Tabela de clientes: nome e email do usuário, CPF e telefone formatados,
 * bairro com cidade/UF, status e a ação de editar. Sem criar nem excluir:
 * clientes nascem do próprio usuário no checkout.
 */
export function CustomerList({
  customers,
  listQuery,
  emptyTitle = 'Nenhum cliente ainda',
  emptySubtitle = 'Os clientes aparecem aqui quando preenchem os dados de entrega no checkout.',
}: CustomerListProps) {
  if (customers.length === 0) {
    return <EmptyListState emoji="👥" title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Bairro</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <Link
                  href={customerRoute(customer.id, listQuery)}
                  className="font-bold transition-colors duration-150 hover:text-brand"
                >
                  {customer.name}
                </Link>
                <p className="text-[12.5px] text-muted-ink">{customer.email}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatCpf(customer.cpf)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatPhone(customer.phone)}</TableCell>
              <TableCell>
                <span className="font-semibold">{customer.neighborhood}</span>
                <p className="text-[12.5px] text-muted-ink">
                  {customer.city}/{customer.state}
                </p>
              </TableCell>
              <TableCell>
                {customer.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="muted">Inativo</Badge>}
              </TableCell>
              <TableCell align="right" className="font-normal">
                <Button asChild variant="ghost" size="icon-sm">
                  <Link
                    href={customerRoute(customer.id, listQuery)}
                    aria-label={`Editar ${customer.name}`}
                    title="Editar"
                  >
                    <Pencil className="size-4" strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
