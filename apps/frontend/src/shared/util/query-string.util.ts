/** `searchParams` já resolvido de uma rota do App Router. */
export type RouteSearchParams = Record<string, string | string[] | undefined>;

/**
 * Monta a query string (sem `?`) a partir dos `searchParams` de uma rota,
 * repetindo a chave para valores em lista e ignorando valores vazios.
 * Ex.: `{ brandId: 'x', page: '3' }` → `"brandId=x&page=3"`.
 */
export function toQueryString(searchParams: RouteSearchParams): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== undefined && item !== '') params.append(key, item);
    }
  }

  return params.toString();
}
