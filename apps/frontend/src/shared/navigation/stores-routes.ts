import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { withQuery } from '@/shared/navigation/with-query.util';

/** Lista paginada de lojas. */
export const STORES_ROUTE = `${ADMIN_ROUTE}/stores`;

/** Lista de lojas com a página e a busca de `query` (ex.: retorno do formulário). */
export function storesRoute(query?: string): string {
  return withQuery(STORES_ROUTE, query);
}

/** Formulário de criação de loja. */
export const STORE_NEW_ROUTE = `${STORES_ROUTE}/new`;

/** Criação de loja levando a query da lista, para voltar à mesma página e busca. */
export function storeNewRoute(query?: string): string {
  return withQuery(STORE_NEW_ROUTE, query);
}

/** Formulário de edição de uma loja; `query` é a da lista, usada no retorno. */
export function storeRoute(id: string, query?: string): string {
  return withQuery(`${STORES_ROUTE}/${encodeURIComponent(id)}`, query);
}
