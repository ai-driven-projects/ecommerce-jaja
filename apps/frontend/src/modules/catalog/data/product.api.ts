import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP dos produtos (`/products`, só administradores). Funções puras sobre
 * `apiRequest`: recebem o token da sessão e lançam `ApiError` em resposta com erro.
 * Os tipos levam o prefixo `Catalog` para não colidir com o `Product` da vitrine.
 */

/** Imagem do produto; `order` começa em 0 e a de menor ordem é a principal. */
export type CatalogProductImage = {
  thumbUrl: string;
  largeUrl: string;
  order: number;
};

/** Produto como devolvido pela API (`ProductDTO`); preços em centavos e datas em ISO. */
export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  brandId: string | null;
  categoryId: string;
  description: string | null;
  priceCents: number;
  listPriceCents: number | null;
  unit: string;
  images: CatalogProductImage[];
  isActive: boolean;
  /** Destaque editorial: aparece em "Em destaque" na página inicial da loja. */
  isFeatured: boolean;
  brandName: string | null;
  /** Nomes dos ancestrais e da própria categoria, ex.: `"Escolar / Cadernos"`. */
  categoryPath: string;
  createdAt: string;
  updatedAt: string;
};

/** Linha da listagem (`ProductListItemDTO`), com a URL da imagem principal. */
export type CatalogProductListItem = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  brandName: string | null;
  categoryPath: string;
  priceCents: number;
  listPriceCents: number | null;
  mainImageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
};

/** Página da listagem (`ProductPageDTO`). */
export type CatalogProductPage = {
  items: CatalogProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Corpo de `POST /products` e `PUT /products/:id`, com preços em centavos. Na
 * alteração, `null` limpa os campos opcionais e `images` substitui a lista
 * inteira (envie sempre a lista completa). `slug` ausente é derivado do nome.
 * `isFeatured` ausente vale `false` na criação e mantém o valor atual na alteração.
 */
export type ProductInput = {
  name: string;
  slug?: string | null;
  sku?: string | null;
  brandId?: string | null;
  categoryId: string;
  description?: string | null;
  priceCents: number;
  listPriceCents?: number | null;
  unit?: string | null;
  images?: CatalogProductImage[];
  isActive?: boolean;
  isFeatured?: boolean;
};

/** Filtros de `GET /products`; `categoryId` inclui as subcategorias. */
export type ProductFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  brandId?: string;
  categoryId?: string;
  isActive?: boolean;
};

const PRODUCTS_PATH = '/products';

function productPath(id: string): string {
  return `${PRODUCTS_PATH}/${encodeURIComponent(id)}`;
}

/** Lista uma página de produtos ordenados por nome; a query string só leva os filtros definidos. */
export function listProducts(token: string, filter: ProductFilter = {}): Promise<CatalogProductPage> {
  const params = new URLSearchParams();
  const search = filter.search?.trim();

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (search) params.set('search', search);
  if (filter.brandId) params.set('brandId', filter.brandId);
  if (filter.categoryId) params.set('categoryId', filter.categoryId);
  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));

  const query = params.toString();
  return apiRequest<CatalogProductPage>(query ? `${PRODUCTS_PATH}?${query}` : PRODUCTS_PATH, { token });
}

/** Busca um produto; inexistente ou excluído responde `404 PRODUCT_NOT_FOUND`. */
export function getProduct(token: string, id: string): Promise<CatalogProduct> {
  return apiRequest<CatalogProduct>(productPath(id), { token });
}

export function createProduct(token: string, data: ProductInput): Promise<CatalogProduct> {
  return apiRequest<CatalogProduct>(PRODUCTS_PATH, { method: 'POST', token, body: data });
}

export function updateProduct(token: string, id: string, data: ProductInput): Promise<CatalogProduct> {
  return apiRequest<CatalogProduct>(productPath(id), { method: 'PUT', token, body: data });
}

/** Exclusão lógica (`204` sem corpo). */
export function deleteProduct(token: string, id: string): Promise<void> {
  return apiRequest<void>(productPath(id), { method: 'DELETE', token });
}
