import { ProductImageDTO } from './product.dto'

// Card of the public storefront list (only visible products, see
// `FindStorefrontProductsQuery`). `brandName`, `categoryName`,
// `rootCategorySlug`, `discountPercent` and `thumbUrl` are computed by the
// read side and never persisted.
export interface StorefrontProductListItemDTO {
  id: string
  slug: string
  name: string
  // `null` without brand or when the brand is inactive or deleted.
  brandName: string | null
  // Name of the product's own category.
  categoryName: string
  // Slug of the root category of the product's tree.
  rootCategorySlug: string
  priceCents: number
  // "De:" price; `null` when the product has none.
  listPriceCents: number | null
  // `round((1 - priceCents / listPriceCents) * 100)` with a list price, otherwise `null`.
  discountPercent: number | null
  unit: string
  // Thumbnail of the main image (order 0), or `null` without images.
  thumbUrl: string | null
  isFeatured: boolean
}

// Brand present in the storefront result, counted with every filter except
// `brandSlugs`.
export interface StorefrontBrandFacetDTO {
  slug: string
  name: string
  // Number of products of the brand in that result.
  count: number
}

// One page of storefront products; `totalPages` is `ceil(total / pageSize)`.
export interface StorefrontProductPageDTO {
  items: StorefrontProductListItemDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  // Ordered by `count` descending, then name; at most 30.
  brandFacets: StorefrontBrandFacetDTO[]
}

// Reference by `slug` and `name`, used for categories and for the brand.
export interface StorefrontCategoryRefDTO {
  slug: string
  name: string
}

// Public product detail (only visible products, see
// `FindStorefrontProductBySlugQuery`). `discountPercent`, `brand` and
// `categories` are computed by the read side and never persisted.
export interface StorefrontProductDetailDTO {
  id: string
  slug: string
  name: string
  sku: string | null
  description: string | null
  priceCents: number
  // "De:" price; `null` when the product has none.
  listPriceCents: number | null
  // `round((1 - priceCents / listPriceCents) * 100)` with a list price, otherwise `null`.
  discountPercent: number | null
  unit: string
  isFeatured: boolean
  // `null` without brand or when the brand is inactive or deleted.
  brand: StorefrontCategoryRefDTO | null
  // From the root category down to the product's own category.
  categories: StorefrontCategoryRefDTO[]
  // Every image, ordered by `order`.
  images: ProductImageDTO[]
}
