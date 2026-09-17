import type { Metadata } from 'next';
import { formatOrderNumber } from '@/modules/orders/data/order.util';
import { OrderMonitorPage } from '@/modules/orders/pages/order-monitor.page';
import { toQueryString, type RouteSearchParams } from '@/shared/util/query-string.util';

type OrderMonitorRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RouteSearchParams>;
};

// No servidor não há sessão: o título usa só o id da URL, sem chamar a API.
export async function generateMetadata({ params }: OrderMonitorRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Pedido #${formatOrderNumber(id)} — Operação` };
}

/**
 * Painel de um pedido de qualquer cliente, lido da API no navegador (`GET
 * /orders/:id` e `/orders/:id/events`) e atualizado pelo stream administrativo do
 * layout. A rota resolve o `id` e a query da lista de origem (retorno).
 */
export default async function OrderMonitorRoute({ params, searchParams }: OrderMonitorRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <OrderMonitorPage key={id} orderId={id} returnQuery={toQueryString(query)} />;
}
