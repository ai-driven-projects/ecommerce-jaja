import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP das lojas (`/stores`, só administradores). Funções puras sobre
 * `apiRequest`: recebem o token da sessão e lançam `ApiError` em resposta com erro.
 */

/** Loja como devolvida pela API (`StoreDTO`); telefone só com dígitos e datas em ISO. */
export type Store = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Uma página de `GET /stores` (`StorePageDTO`). */
export type StorePage = {
  items: Store[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Corpo de `POST /stores` e `PUT /stores/:id`. `null` (ou `''`) limpa telefone e
 * endereço; `slug` ausente é derivado do nome na criação e mantido na alteração;
 * sem `deliveryRadiusMeters` a criação usa 1.000 m.
 */
export type StoreInput = {
  name: string;
  slug?: string;
  phone?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusMeters?: number;
  isActive?: boolean;
};

/**
 * Filtros da listagem. Sem `page`/`pageSize` a API usa a página 1 com 20 lojas;
 * `search` é texto livre sobre nome, slug e endereço.
 */
export type StoreFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
};

const STORES_PATH = '/stores';

function storePath(id: string): string {
  return `${STORES_PATH}/${encodeURIComponent(id)}`;
}

/**
 * Uma página de lojas: ordenada por nome, ou pelas que melhor casam com a busca.
 * A query string só leva os filtros definidos.
 */
export function listStores(token: string, filter: StoreFilter = {}): Promise<StorePage> {
  const params = new URLSearchParams();
  const search = filter.search?.trim();

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (search) params.set('search', search);
  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));

  const query = params.toString();
  return apiRequest<StorePage>(query ? `${STORES_PATH}?${query}` : STORES_PATH, { token });
}

/** Busca uma loja; inexistente, excluída ou id malformado responde `404 STORE_NOT_FOUND`. */
export function getStore(token: string, id: string): Promise<Store> {
  return apiRequest<Store>(storePath(id), { token });
}

export function createStore(token: string, data: StoreInput): Promise<Store> {
  return apiRequest<Store>(STORES_PATH, { method: 'POST', token, body: data });
}

export function updateStore(token: string, id: string, data: StoreInput): Promise<Store> {
  return apiRequest<Store>(storePath(id), { method: 'PUT', token, body: data });
}

/** Exclusão lógica (`204` sem corpo). */
export function deleteStore(token: string, id: string): Promise<void> {
  return apiRequest<void>(storePath(id), { method: 'DELETE', token });
}
