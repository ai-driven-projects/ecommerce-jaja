import { ApiError, apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP da loja pública (`/storefront`, sem token). Os tipos espelham os
 * DTOs de leitura da vitrine: só produtos visíveis (ativos, em categorias
 * ativas), preços em centavos e imagens já ordenadas.
 */

/** Ordenações aceitas pela API; sem `sort`, vale `relevance` com busca e `featured` sem. */
export const STOREFRONT_PRODUCT_SORTS = ['relevance', 'featured', 'price-asc', 'price-desc', 'name', 'discount'] as const;

export type StorefrontProductSort = (typeof STOREFRONT_PRODUCT_SORTS)[number];

/** Card da vitrine (`StorefrontProductListItemDTO`). */
export type StorefrontProductListItem = {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  /** Nome da categoria do produto (a folha). */
  categoryName: string;
  /** Slug da categoria raiz: define o emoji e o tom de reserva. */
  rootCategorySlug: string;
  priceCents: number;
  listPriceCents: number | null;
  /** Percentual de desconto sobre o preço "De:"; `null` sem oferta. */
  discountPercent: number | null;
  unit: string;
  /** Miniatura da imagem principal (~200px). */
  thumbUrl: string | null;
  isFeatured: boolean;
};

/** Marca presente no resultado, calculada sem o filtro de marca. */
export type StorefrontBrandFacet = {
  slug: string;
  name: string;
  count: number;
};

export type StorefrontProductPage = {
  items: StorefrontProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  brandFacets: StorefrontBrandFacet[];
};

/** Referência por slug e nome (marca ou categoria). */
export type StorefrontRef = {
  slug: string;
  name: string;
};

export type StorefrontProductImage = {
  /** Miniatura (~200px). */
  thumbUrl: string;
  /** Imagem grande (~1000px). */
  largeUrl: string;
  order: number;
};

/** Detalhe do produto (`StorefrontProductDetailDTO`). */
export type StorefrontProductDetail = {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  description: string | null;
  priceCents: number;
  listPriceCents: number | null;
  discountPercent: number | null;
  unit: string;
  isFeatured: boolean;
  brand: StorefrontRef | null;
  /** Da raiz até a categoria do produto. */
  categories: StorefrontRef[];
  /** Ordenadas por `order`; a primeira é a principal. */
  images: StorefrontProductImage[];
};

/** Nó da árvore de categorias da loja: só categorias com produtos visíveis. */
export type StorefrontCategory = {
  slug: string;
  name: string;
  level: number;
  parentSlug: string | null;
  isHighlighted: boolean;
  /** Produtos visíveis na categoria e nas descendentes. */
  productCount: number;
  children: StorefrontCategory[];
};

/** Filtros de `GET /storefront/products`; todos combinados com E. */
export type StorefrontProductFilter = {
  page?: number;
  pageSize?: number;
  search?: string;
  /** A categoria e as descendentes. */
  categorySlug?: string;
  /** Qualquer uma das marcas. */
  brandSlugs?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  onSale?: boolean;
  featured?: boolean;
  sort?: StorefrontProductSort;
};

const STOREFRONT_PATH = '/storefront';
const PRODUCTS_PATH = `${STOREFRONT_PATH}/products`;

/** Árvore de categorias da loja, na ordem de exibição. */
export function listStorefrontCategories(): Promise<StorefrontCategory[]> {
  return apiRequest<StorefrontCategory[]>(`${STOREFRONT_PATH}/categories`);
}

/** Uma página de produtos visíveis; a query string só leva os filtros definidos. */
export function listStorefrontProducts(filter: StorefrontProductFilter = {}): Promise<StorefrontProductPage> {
  const params = new URLSearchParams();
  const search = filter.search?.trim();
  const brands = filter.brandSlugs?.filter(Boolean) ?? [];

  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (search) params.set('search', search);
  if (filter.categorySlug) params.set('category', filter.categorySlug);
  if (brands.length > 0) params.set('brand', brands.join(','));
  if (filter.minPriceCents !== undefined) params.set('minPriceCents', String(filter.minPriceCents));
  if (filter.maxPriceCents !== undefined) params.set('maxPriceCents', String(filter.maxPriceCents));
  if (filter.onSale) params.set('onSale', 'true');
  if (filter.featured) params.set('featured', 'true');
  if (filter.sort) params.set('sort', filter.sort);

  const query = params.toString();
  return apiRequest<StorefrontProductPage>(query ? `${PRODUCTS_PATH}?${query}` : PRODUCTS_PATH);
}

/**
 * Detalhe de um produto visível. `null` quando não existe ou não está visível
 * (`404 PRODUCT_NOT_FOUND`); os demais erros são propagados.
 */
export async function getStorefrontProduct(slug: string): Promise<StorefrontProductDetail | null> {
  if (!slug.trim()) return null;

  try {
    return await apiRequest<StorefrontProductDetail>(`${PRODUCTS_PATH}/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.codes.includes('PRODUCT_NOT_FOUND')) return null;
    throw error;
  }
}
