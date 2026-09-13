import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP das categorias (`/categories`, só administradores). Funções puras
 * sobre `apiRequest`: recebem o token da sessão e lançam `ApiError` em resposta com erro.
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
  createdAt: string;
  updatedAt: string;
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

export type CategoryFilter = {
  isActive?: boolean;
};

const CATEGORIES_PATH = '/categories';

function categoryPath(id: string): string {
  return `${CATEGORIES_PATH}/${encodeURIComponent(id)}`;
}

/** Lista plana de categorias, ordenada por `path`; a query string só leva os filtros definidos. */
export function listCategories(token: string, filter: CategoryFilter = {}): Promise<CatalogCategory[]> {
  const params = new URLSearchParams();

  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));

  const query = params.toString();
  return apiRequest<CatalogCategory[]>(query ? `${CATEGORIES_PATH}?${query}` : CATEGORIES_PATH, { token });
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

/** Exclusão lógica (`204` sem corpo); categoria com filhas responde `409 CATEGORY_HAS_CHILDREN`. */
export function deleteCategory(token: string, id: string): Promise<void> {
  return apiRequest<void>(categoryPath(id), { method: 'DELETE', token });
}
