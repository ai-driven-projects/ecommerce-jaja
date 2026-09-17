// Text search helpers shared by the adapters that search in raw SQL
// (`BrandPrisma`, `CategoryPrisma`, `CustomerPrisma`, `OrderPrisma`). Each
// adapter builds its own condition from its columns; these helpers keep folding
// and term parsing equal.

// Accent folding done with `translate`, in both cases, so the database needs
// no `unaccent` extension.
const ACCENTED = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const UNACCENTED = 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN';

/** Terms beyond this limit are ignored by `toPrefixTsQuery`. */
export const MAX_SEARCH_TERMS = 10;

/**
 * SQL expression that lowercases and removes accents from `expression`
 * (a trusted column expression, never user input): `name` →
 * `lower(translate(name, 'á…', 'a…'))`.
 */
export function folded(expression: string): string {
  return `lower(translate(${expression}, '${ACCENTED}', '${UNACCENTED}'))`;
}

/**
 * Splits free text into search terms without accents, in lowercase, keeping
 * only `[a-z0-9]`: `"Café  3M"` → `["cafe", "3m"]`. At most
 * `MAX_SEARCH_TERMS` terms; text without terms yields `[]`. The terms are safe
 * inside `LIKE` patterns (no wildcard characters).
 */
export function toSearchTerms(search: string): string[] {
  return search
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);
}

/**
 * Turns free text into a prefix tsquery where every term must match the start
 * of a word: `"Café  3M"` → `"cafe:* & 3m:*"`. Terms keep only `[a-z0-9]`, so
 * the query is always valid; text without terms yields `null` (no search).
 */
export function toPrefixTsQuery(search: string): string | null {
  const terms = toSearchTerms(search);
  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(' & ') : null;
}
