'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { EmptyListState } from '@/shared/components/ui/empty-list-state';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { TableCard } from '@/shared/components/ui/table-card';
import { ORDERS_ROUTE } from '@/shared/navigation/orders-routes';
import { cn } from '@/shared/lib/class-name.util';
import type { OrderStatusFilter } from '../data/admin-order.api';
import { useOrdersLive } from '../data/orders-live.context';
import { ORDER_STATUS_LABEL, ORDER_STEPS } from '../data/order-status.util';
import { useOrders } from '../data/use-orders.hook';
import { useOrdersSummary } from '../data/use-orders-summary.hook';
import { LiveIndicator } from './live-indicator.component';
import { OrderListTable } from './order-list-table.component';

/** Chips de status: Todos, Em andamento e cada status na ordem do pedido. */
const STATUS_FILTERS: ReadonlyArray<{ label: string; value: OrderStatusFilter | undefined }> = [
  { label: 'Todos', value: undefined },
  { label: 'Em andamento', value: 'IN_PROGRESS' },
  ...ORDER_STEPS.map((step) => ({ label: ORDER_STATUS_LABEL[step.status], value: step.status })),
];

const SKELETON_ROWS = 6;

// Estrutura estática da tabela (sem shimmer) enquanto a primeira leitura responde.
function OrderListSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <div key={`order-skeleton-${index}`} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
          <div className="h-4 w-20 rounded-md bg-surface" />
          <div className="h-4 w-36 rounded-md bg-surface" />
          <div className="hidden h-4 w-44 rounded-md bg-surface sm:block" />
          <div className="h-6 w-28 rounded-pill bg-surface" />
          <div className="ml-auto h-4 w-16 rounded-md bg-surface" />
        </div>
      ))}
    </div>
  );
}

/** Estrutura da lista enquanto página, status e busca da URL são resolvidos (fallback do `<Suspense>`). */
export function OrdersDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-32 rounded-md bg-surface" />
        <div className="h-4 w-48 rounded-md bg-surface" />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="h-[42px] w-full max-w-md rounded-pill bg-surface" />
        <div className="h-9 w-full max-w-2xl rounded-pill bg-surface" />
      </div>
      <OrderListSkeleton />
    </div>
  );
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Lista de pedidos da operação, ao vivo (`/admin/orders`):
 * - cabeçalho "Pedidos" com "N pedido(s) · M em andamento" (N da lista com os
 *   filtros atuais; M do resumo do dia) e o indicador ao vivo;
 * - busca por número ou cliente e chips de status, com página, status e busca na URL;
 * - a tabela (`OrderListTable`), com a linha inteira levando ao painel do pedido,
 *   destaque nas linhas novas e na célula de status que mudou, e a paginação;
 * - vazio sem filtros ("Nenhum pedido ainda."), sem resultado com filtros
 *   ("Nenhum pedido encontrado." + "Limpar filtros") e carregando com blocos creme.
 *
 * Lista e resumo são relidos a cada aviso do stream administrativo, sem
 * recarregar. Precisa estar dentro de `<Suspense>` (usa `useSearchParams`).
 */
export function OrdersDashboardComponent() {
  const { status: liveStatus } = useOrdersLive();
  const { summary } = useOrdersSummary();
  const {
    orders,
    total,
    totalPages,
    page,
    loading,
    firstLoad,
    searchInput,
    setSearchInput,
    status,
    filtered,
    listQuery,
    newIds,
    statusChanged,
    setPage,
    setStatus,
  } = useOrders();

  const subtitle = firstLoad
    ? 'Carregando pedidos…'
    : `${plural(total, 'pedido', 'pedidos')}${summary ? ` · ${summary.inProgress} em andamento` : ''}`;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader title="Pedidos" subtitle={subtitle} aside={<LiveIndicator status={liveStatus} />} />

      <div className="flex flex-col gap-2.5">
        <div
          role="search"
          className="flex w-full max-w-md items-center gap-2.5 rounded-pill border border-line bg-surface px-[18px] transition-colors duration-150 focus-within:border-brand"
        >
          <Search className="size-[17px] shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Buscar pedidos por número ou cliente"
            placeholder="Buscar por número ou cliente"
            autoComplete="off"
            className="h-[42px] w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-placeholder focus-visible:outline-none"
          />
        </div>

        <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((option) => {
            const active = status === option.value;
            return (
              <button
                key={option.label}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(option.value)}
                className={cn(
                  'rounded-pill border px-[15px] py-2 text-[13.5px] font-bold transition-colors duration-150',
                  active ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-card text-ink hover:bg-surface',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {firstLoad ? (
        <OrderListSkeleton />
      ) : (
        <div className={cn('flex flex-col gap-4', loading && 'opacity-60')} aria-busy={loading}>
          {orders.length === 0 ? (
            filtered ? (
              <EmptyListState
                emoji="🔎"
                title="Nenhum pedido encontrado."
                subtitle="Nenhum pedido corresponde aos filtros atuais."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href={ORDERS_ROUTE}>Limpar filtros</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyListState
                emoji="📦"
                title="Nenhum pedido ainda."
                subtitle="Os pedidos feitos na loja aparecem aqui na hora, sem recarregar."
              />
            )
          ) : (
            <TableCard>
              <OrderListTable
                orders={orders}
                listQuery={listQuery}
                showTotal
                newIds={newIds}
                statusChanged={statusChanged}
              />
            </TableCard>
          )}

          {total > 0 ? (
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={total}
              totalLabel="pedidos"
              onPageChange={setPage}
              disabled={loading}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
