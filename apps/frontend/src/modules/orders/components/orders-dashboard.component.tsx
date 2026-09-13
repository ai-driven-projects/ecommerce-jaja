'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CourierCell, OrderStatusBadge } from '@/modules/admin/components/order-status.component';
import { ONGOING_ORDERS, ORDER_STATUS_LABEL, type OrderStatus } from '@/modules/admin/data/dashboard.mock';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { TableCard } from '@/shared/components/ui/table-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { orderTrackingRoute } from '@/shared/navigation/storefront-routes';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';

type Filter = 'todos' | OrderStatus;

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'separando', label: ORDER_STATUS_LABEL.separando },
  { id: 'caminho', label: ORDER_STATUS_LABEL.caminho },
  { id: 'atrasado', label: ORDER_STATUS_LABEL.atrasado },
  { id: 'entregue', label: ORDER_STATUS_LABEL.entregue },
];

/** Pedidos do hub: filtros por status em pílulas e a tabela com destino, entregador, ETA e total. */
export function OrdersDashboardComponent() {
  const [filter, setFilter] = useState<Filter>('todos');
  const orders = ONGOING_ORDERS.filter((order) => filter === 'todos' || order.status === filter);
  const lateCount = ONGOING_ORDERS.filter((order) => order.status === 'atrasado').length;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Pedidos"
        subtitle={`${ONGOING_ORDERS.length} pedidos hoje · ${lateCount} atrasado${lateCount === 1 ? '' : 's'} · dados locais de exemplo`}
      />

      <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const isActive = option.id === filter;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilter(option.id)}
              className={cn(
                'rounded-pill border px-[15px] py-2 text-[13.5px] font-bold transition-colors duration-150',
                isActive ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-card text-ink hover:bg-surface',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </nav>

      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Entregador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">ETA</TableHead>
              <TableHead align="right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={orderTrackingRoute(order.id)} className="font-extrabold transition-colors duration-150 hover:text-brand">
                    #{order.id}
                  </Link>
                </TableCell>
                <TableCell>
                  {order.destination}
                  <span className="text-muted-ink"> · {order.itemsLabel}</span>
                </TableCell>
                <TableCell>
                  <CourierCell mode={order.mode} name={order.courier} />
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell align="right" className={order.late ? 'text-danger' : undefined}>
                  {order.etaLabel}
                </TableCell>
                <TableCell align="right">{formatPrice(order.totalCents)}</TableCell>
              </TableRow>
            ))}
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-ink">
                  Nenhum pedido com este status.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
