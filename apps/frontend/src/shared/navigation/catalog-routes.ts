import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';

export const CATALOG_ROUTE = `${ADMIN_ROUTE}/catalog`;

/** Lista paginada de marcas do catálogo. */
export const CATALOG_BRANDS_ROUTE = `${CATALOG_ROUTE}/brands`;

/** Lista de marcas com a página e a busca de `query` (ex.: retorno do formulário). */
export function catalogBrandsRoute(query?: string): string {
  return withQuery(CATALOG_BRANDS_ROUTE, query);
}

/** Formulário de criação de marca. */
export const CATALOG_BRAND_NEW_ROUTE = `${CATALOG_BRANDS_ROUTE}/new`;

/** Criação de marca levando a query da lista, para voltar à mesma página e busca. */
export function catalogBrandNewRoute(query?: string): string {
  return withQuery(CATALOG_BRAND_NEW_ROUTE, query);
}

/** Formulário de edição de uma marca; `query` é a da lista, usada no retorno. */
export function catalogBrandRoute(id: string, query?: string): string {
  return withQuery(`${CATALOG_BRANDS_ROUTE}/${encodeURIComponent(id)}`, query);
}

/** Árvore de categorias do catálogo. */
export const CATALOG_CATEGORIES_ROUTE = `${CATALOG_ROUTE}/categories`;

/** Formulário de criação de categoria. */
export const CATALOG_CATEGORY_NEW_ROUTE = `${CATALOG_CATEGORIES_ROUTE}/new`;

/** Formulário de criação de subcategoria, com a categoria pai pré-selecionada. */
export function catalogSubcategoryNewRoute(parentId: string): string {
  return `${CATALOG_CATEGORY_NEW_ROUTE}?parentId=${encodeURIComponent(parentId)}`;
}

/** Formulário de edição de uma categoria. */
export function catalogCategoryRoute(id: string): string {
  return `${CATALOG_CATEGORIES_ROUTE}/${encodeURIComponent(id)}`;
}

/** Anexa a query string (com ou sem `?`) à rota; vazia devolve a rota como está. */
function withQuery(route: string, query?: string): string {
  const normalized = query?.replace(/^\?/, '') ?? '';
  return normalized ? `${route}?${normalized}` : route;
}

/** Lista paginada de produtos do catálogo. */
export const CATALOG_PRODUCTS_ROUTE = `${CATALOG_ROUTE}/products`;

/** Lista de produtos com a página e os filtros de `query` (ex.: retorno do formulário). */
export function catalogProductsRoute(query?: string): string {
  return withQuery(CATALOG_PRODUCTS_ROUTE, query);
}

/** Formulário de criação de produto. */
export const CATALOG_PRODUCT_NEW_ROUTE = `${CATALOG_PRODUCTS_ROUTE}/new`;

/** Criação de produto levando a query da lista, para voltar à mesma página e filtros. */
export function catalogProductNewRoute(query?: string): string {
  return withQuery(CATALOG_PRODUCT_NEW_ROUTE, query);
}

/** Formulário de edição de um produto; `query` é a da lista, usada no retorno. */
export function catalogProductRoute(id: string, query?: string): string {
  return withQuery(`${CATALOG_PRODUCTS_ROUTE}/${encodeURIComponent(id)}`, query);
}
