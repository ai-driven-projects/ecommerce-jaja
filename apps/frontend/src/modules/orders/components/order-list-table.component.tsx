'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { orderMonitorRoute } from '@/shared/navigation/orders-routes';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import type { OrderListItem } from '../data/admin-order.api';
import type { OrderStatus } from '../data/order.api';
import { formatOrderNumber, formatOrderTimeWithSeconds } from '../data/order.util';
import { OrderStatusBadge } from './order-status-badge.component';

type OrderListTableProps = {
  orders: readonly OrderListItem[];
  /** Query string da lista (página, status e busca), levada ao painel para o retorno. */
  listQuery?: string;
  /** Mostra a coluna "Total" (a lista mostra; "Pedidos em andamento" do dashboard não). */
  showTotal?: boolean;
  /** Pedidos que chegaram com a tela aberta: a linha recebe o destaque breve. */
  newIds?: ReadonlySet<string>;
  /** `true` quando o status do pedido mudou com a tela aberta: a célula de status recebe o destaque. */
  statusChanged?: (id: string, status: OrderStatus) => boolean;
};

/** Texto do destino: "bairro · cidade · N itens". */
function destinationOf(order: OrderListItem): { place: string; items: string } {
  return {
    place: `${order.deliveryNeighborhood} · ${order.deliveryCity}`,
    items: `${order.itemCount} ${order.itemCount === 1 ? 'item' : 'itens'}`,
  };
}

/**
 * Tabela de pedidos do admin (lista `/admin/orders` e "Pedidos em andamento" do
 * dashboard): Pedido (`#` + número), Cliente, Destino, Status, Atualizado
 * (`HH:MM:SS` de `statusChangedAt`) e, opcionalmente, Total.
 *
 * - A linha inteira leva ao painel do pedido: o número é um link (teclado e
 *   leitores de tela) e o clique em qualquer ponto da linha navega; com Ctrl/⌘
 *   abre em outra aba.
 * - Destaques ao vivo com `motion-safe:` (sem animação com `prefers-reduced-motion`):
 *   a linha nova e a célula de status que mudou. A célula é recriada a cada troca
 *   de status (`key`), então o destaque se repete a cada passo.
 * - Rola na horizontal dentro do cartão em telas estreitas.
 *
 * Horários no fuso do navegador: a área administrativa só renderiza depois da
 * hidratação (`AdminGuard`).
 */
export function OrderListTable({ orders, listQuery, showTotal = false, newIds, statusChanged }: OrderListTableProps) {
  const router = useRouter();

  const openOrder = (event: MouseEvent<HTMLTableRowElement>, href: string) => {
    // O link do número já navega sozinho.
    if ((event.target as HTMLElement).closest('a')) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    router.push(href);
  };

  return (
    <Table className={showTotal ? 'min-w-[720px]' : 'min-w-[600px]'}>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Destino</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Atualizado</TableHead>
          {showTotal ? <TableHead align="right">Total</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const href = orderMonitorRoute(order.id, listQuery);
          const number = formatOrderNumber(order.id);
          const destination = destinationOf(order);

          return (
            <TableRow
              key={order.id}
              onClick={(event) => openOrder(event, href)}
              className={cn('cursor-pointer', newIds?.has(order.id) && 'motion-safe:animate-live-new')}
            >
              <TableCell className="whitespace-nowrap">
                <Link
                  href={href}
                  aria-label={`Abrir o pedido #${number}`}
                  className="font-extrabold tabular-nums transition-colors duration-150 hover:text-brand"
                >
                  #{number}
                </Link>
              </TableCell>
              <TableCell className="font-semibold">{order.customerName}</TableCell>
              <TableCell>
                {destination.place}
                <span className="whitespace-nowrap text-muted-ink"> · {destination.items}</span>
              </TableCell>
              <TableCell
                key={`status-${order.status}`}
                className={cn('rounded-xl', statusChanged?.(order.id, order.status) && 'motion-safe:animate-live-new')}
              >
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums text-ink-soft">
                {formatOrderTimeWithSeconds(order.statusChangedAt)}
              </TableCell>
              {showTotal ? (
                <TableCell align="right" className="whitespace-nowrap tabular-nums">
                  {formatPrice(order.totalCents)}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
