import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { withQuery } from '@/shared/navigation/with-query.util';

/** Lista de pedidos ao vivo. */
export const ORDERS_ROUTE = `${ADMIN_ROUTE}/orders`;

/** Lista de pedidos com a página, o status e a busca de `query` (ex.: retorno do painel). */
export function ordersRoute(query?: string): string {
  return withQuery(ORDERS_ROUTE, query);
}

/** Painel de um pedido; `query` é a da lista, usada no link "← Pedidos". */
export function orderMonitorRoute(id: string, query?: string): string {
  return withQuery(`${ORDERS_ROUTE}/${encodeURIComponent(id)}`, query);
}
