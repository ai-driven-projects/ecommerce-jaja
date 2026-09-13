/** Anexa a query string (com ou sem `?`) à rota; vazia devolve a rota como está. */
export function withQuery(route: string, query?: string): string {
  const normalized = query?.replace(/^\?/, '') ?? '';
  return normalized ? `${route}?${normalized}` : route;
}
