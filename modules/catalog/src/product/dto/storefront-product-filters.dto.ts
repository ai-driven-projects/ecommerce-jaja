// Orders accepted by the storefront product list (see `FindStorefrontProductsQuery`).
export const STOREFRONT_PRODUCT_SORTS = [
  'relevance',
  'featured',
  'price-asc',
  'price-desc',
  'name',
  'discount',
] as const

export type StorefrontProductSort = (typeof STOREFRONT_PRODUCT_SORTS)[number]

// Already normalized by the caller: `page` and `pageSize` are integers >= 1
// (`pageSize` capped by the API), `search` is trimmed, `brandSlugs` has no
// empty values, prices are integers >= 0 and absent/invalid optional params
// (including an unknown `sort`) are omitted.
export interface StorefrontProductFiltersDTO {
  page: number
  pageSize: number
  search?: string
  categorySlug?: string
  brandSlugs?: string[]
  minPriceCents?: number
  maxPriceCents?: number
  onSale?: boolean
  featured?: boolean
  sort?: StorefrontProductSort
}
