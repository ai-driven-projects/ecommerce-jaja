import { withQuery } from './with-query.util';

export const STOREFRONT_ROUTE = '/';
export const STOREFRONT_LOGIN_ROUTE = '/entrar';
export const CHECKOUT_ROUTE = '/checkout';
export const MY_ACCOUNT_ROUTE = '/minha-conta';

/** "Minha conta", levando a query da vitrine (loja, categoria…) para a loja escolhida seguir para a página. */
export function myAccountRoute(query?: string): string {
  return withQuery(MY_ACCOUNT_ROUTE, query);
}

/** Página pública de acompanhamento de um pedido. */
export function orderTrackingRoute(orderId: string): string {
  return `/pedidos/${encodeURIComponent(orderId)}/acompanhar`;
}

/** Detalhe público de um produto. */
export function productRoute(slug: string, query?: string): string {
  const base = `/p/${encodeURIComponent(slug)}`;
  return query ? `${base}?${query}` : base;
}
