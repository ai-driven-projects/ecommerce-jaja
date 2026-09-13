import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { withQuery } from '@/shared/navigation/with-query.util';

/** Lista paginada de clientes. */
export const CUSTOMERS_ROUTE = `${ADMIN_ROUTE}/customers`;

/** Lista de clientes com a página, a busca e o status de `query` (ex.: retorno do formulário). */
export function customersRoute(query?: string): string {
  return withQuery(CUSTOMERS_ROUTE, query);
}

/** Formulário de edição de um cliente; `query` é a da lista, usada no retorno. */
export function customerRoute(id: string, query?: string): string {
  return withQuery(`${CUSTOMERS_ROUTE}/${encodeURIComponent(id)}`, query);
}
