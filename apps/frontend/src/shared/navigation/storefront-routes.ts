export const STOREFRONT_ROUTE = '/';
export const STOREFRONT_LOGIN_ROUTE = '/entrar';
export const CHECKOUT_ROUTE = '/checkout';

/** Página pública de acompanhamento de um pedido. */
export function orderTrackingRoute(orderId: string): string {
  return `/pedidos/${encodeURIComponent(orderId)}/acompanhar`;
}

/** Detalhe público de um produto. */
export function productRoute(slug: string, query?: string): string {
  const base = `/p/${encodeURIComponent(slug)}`;
  return query ? `${base}?${query}` : base;
}
