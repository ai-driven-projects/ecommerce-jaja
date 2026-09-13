/** Mudanças na query string de uma lista; `undefined` ou vazio remove o parâmetro. */
export type ListQueryChanges = Record<string, string | undefined>;

/** Rota atual com a query alterada; valores vazios saem da URL. */
export function buildListHref(pathname: string, currentQuery: string, changes: ListQueryChanges): string {
  const params = new URLSearchParams(currentQuery);

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '') params.delete(key);
    else params.set(key, value);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Página 1 não aparece na URL. */
export function pageParam(page: number): string | undefined {
  return page > 1 ? String(page) : undefined;
}

/** `page` da URL; ausente ou inválido vale 1. */
export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}
