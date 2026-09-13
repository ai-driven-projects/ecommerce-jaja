import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP das categorias (`/categories`, só administradores). Funções puras
 * sobre `apiRequest`: recebem o token da sessão e lançam `ApiError` em resposta com erro.
 * Os tipos levam o prefixo `Catalog` para não colidir com o `Category` da vitrine.
 */

/** Nível na hierarquia: departamento (1), grupo (2) ou subgrupo (3). */
export type CategoryLevel = 1 | 2 | 3;

/** Categoria como devolvida pela API (`CategoryDTO`); datas em ISO. */
export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** `null` quando a categoria é raiz. */
  parentId: string | null;
  order: number;
  isHighlighted: boolean;
  imageUrl: string | null;
  isActive: boolean;
  level: CategoryLevel;
  /** Nomes dos ancestrais e da própria categoria, ex.: `"Escolar / Borrachas"`. */
  path: string;
  /** Filhas diretas não excluídas. */
  childrenCount: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Nó da árvore (`CategoryTreeNodeDTO`). `children` vem preenchido só na árvore
 * expandida; na recolhida e em `listCategoryChildren` vem vazio, e
 * `childrenCount` indica se o nó tem filhas a buscar.
 */
export type CatalogCategoryNode = CatalogCategory & {
  children: CatalogCategoryNode[];
};

/** Uma página de `GET /categories` (`CategoryPageDTO`). */
export type CategoryPage = {
  items: CatalogCategory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Uma página de `GET /categories/tree` (`CategoryTreePageDTO`); `total` conta só as raízes. */
export type CategoryTreePage = {
  items: CatalogCategoryNode[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Corpo de `POST /categories` e `PUT /categories/:id`. Na alteração, campo
 * omitido mantém o valor; `null` limpa `parentId` (vira raiz), `description` e
 * `imageUrl`. `slug` ausente é derivado do nome na criação e mantido na alteração.
 */
export type CategoryInput = {
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: string | null;
  order?: number | null;
  isHighlighted?: boolean | null;
  imageUrl?: string | null;
  isActive?: boolean | null;
};

/**
 * Filtros de `GET /categories`. Sem `page`/`pageSize` a API usa a página 1 com
 * 20 categorias (máximo 100). `search` é texto livre sobre nome, slug e
 * descrição; `maxLevel` limita o nível; `excludeSubtreeOf` tira a categoria e
 * suas descendentes (seletor de pai na edição).
 */
export type CategoryFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  maxLevel?: CategoryLevel;
  excludeSubtreeOf?: string;
};

/** Filtros de `GET /categories/tree`; `expanded` traz a subárvore de cada raiz da página. */
export type CategoryTreeFilter = {
  page?: number;
  pageSize?: number;
  expanded?: boolean;
};

const CATEGORIES_PATH = '/categories';

function categoryPath(id: string): string {
  return `${CATEGORIES_PATH}/${encodeURIComponent(id)}`;
}

function withParams(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Uma página de categorias em qualquer nível: ordenada pelo caminho, ou pelas
 * que melhor casam com a busca. A query string só leva os filtros definidos.
 */
export function listCategories(token: string, filter: CategoryFilter = {}): Promise<CategoryPage> {
  const params = new URLSearchParams();
  const search = filter.search?.trim();

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (search) params.set('search', search);
  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));
  if (filter.maxLevel !== undefined) params.set('maxLevel', String(filter.maxLevel));
  if (filter.excludeSubtreeOf) params.set('excludeSubtreeOf', filter.excludeSubtreeOf);

  return apiRequest<CategoryPage>(withParams(CATEGORIES_PATH, params), { token });
}

/**
 * Uma página de raízes (ordem `order`, nome). Recolhida, cada nó vem com
 * `children: []`; com `expanded`, com filhas e netas.
 */
export function listCategoryTree(token: string, filter: CategoryTreeFilter = {}): Promise<CategoryTreePage> {
  const params = new URLSearchParams();

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (filter.expanded) params.set('expanded', 'true');

  return apiRequest<CategoryTreePage>(withParams(`${CATEGORIES_PATH}/tree`, params), { token });
}

/** Filhas diretas de uma categoria, na ordem das irmãs; pai inexistente responde `404 CATEGORY_NOT_FOUND`. */
export function listCategoryChildren(token: string, id: string): Promise<CatalogCategoryNode[]> {
  return apiRequest<CatalogCategoryNode[]>(`${categoryPath(id)}/children`, { token });
}

/** Busca uma categoria; inexistente ou excluída responde `404 CATEGORY_NOT_FOUND`. */
export function getCategory(token: string, id: string): Promise<CatalogCategory> {
  return apiRequest<CatalogCategory>(categoryPath(id), { token });
}

export function createCategory(token: string, data: CategoryInput): Promise<CatalogCategory> {
  return apiRequest<CatalogCategory>(CATEGORIES_PATH, { method: 'POST', token, body: data });
}

export function updateCategory(token: string, id: string, data: CategoryInput): Promise<CatalogCategory> {
  return apiRequest<CatalogCategory>(categoryPath(id), { method: 'PUT', token, body: data });
}

/**
 * Exclusão lógica (`204` sem corpo); categoria com filhas responde
 * `409 CATEGORY_HAS_CHILDREN` e com produtos, `409 CATEGORY_HAS_PRODUCTS`.
 */
export function deleteCategory(token: string, id: string): Promise<void> {
  return apiRequest<void>(categoryPath(id), { method: 'DELETE', token });
}
