import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP das marcas (`/brands`, só administradores). Funções puras sobre
 * `apiRequest`: recebem o token da sessão e lançam `ApiError` em resposta com erro.
 */

/** Marca como devolvida pela API (`BrandDTO`); datas em ISO. */
export type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Uma página de `GET /brands` (`BrandPageDTO`). */
export type BrandPage = {
  items: Brand[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Corpo de `POST /brands` e `PUT /brands/:id`. `null` limpa descrição e logo;
 * `slug` ausente é derivado do nome na criação e mantido na alteração.
 */
export type BrandInput = {
  name: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
};

/**
 * Filtros da listagem. Sem `page`/`pageSize` a API usa a página 1 com 20 marcas;
 * `search` é texto livre sobre nome, slug e descrição.
 */
export type BrandFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
};

const BRANDS_PATH = '/brands';

function brandPath(id: string): string {
  return `${BRANDS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * Uma página de marcas: ordenada por nome, ou pelas que melhor casam com a busca.
 * A query string só leva os filtros definidos.
 */
export function listBrands(token: string, filter: BrandFilter = {}): Promise<BrandPage> {
  const params = new URLSearchParams();
  const search = filter.search?.trim();

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (search) params.set('search', search);
  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));

  const query = params.toString();
  return apiRequest<BrandPage>(query ? `${BRANDS_PATH}?${query}` : BRANDS_PATH, { token });
}

/** Busca uma marca; inexistente ou excluída responde `404 BRAND_NOT_FOUND`. */
export function getBrand(token: string, id: string): Promise<Brand> {
  return apiRequest<Brand>(brandPath(id), { token });
}

export function createBrand(token: string, data: BrandInput): Promise<Brand> {
  return apiRequest<Brand>(BRANDS_PATH, { method: 'POST', token, body: data });
}

export function updateBrand(token: string, id: string, data: BrandInput): Promise<Brand> {
  return apiRequest<Brand>(brandPath(id), { method: 'PUT', token, body: data });
}

/** Exclusão lógica (`204` sem corpo). */
export function deleteBrand(token: string, id: string): Promise<void> {
  return apiRequest<void>(brandPath(id), { method: 'DELETE', token });
}
