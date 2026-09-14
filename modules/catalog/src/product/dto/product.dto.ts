export interface ProductImageDTO {
  thumbUrl: string
  largeUrl: string
  // Position in the product list (0 = main image).
  order: number
}

// Read projection of a product. `brandName` and `categoryPath` (ancestor names
// and its own, joined by " / ", like `CategoryDTO.path`) are computed by the
// read side and never persisted.
export interface ProductDTO {
  id: string
  name: string
  slug: string
  sku: string | null
  brandId: string | null
  categoryId: string
  description: string | null
  priceCents: number
  listPriceCents: number | null
  unit: string
  // Ordered by `order`.
  images: ProductImageDTO[]
  isActive: boolean
  // Editorial highlight on the storefront ("Em destaque").
  isFeatured: boolean
  brandName: string | null
  categoryPath: string
  createdAt: Date
  updatedAt: Date
}

// Row of the paginated product list.
export interface ProductListItemDTO {
  id: string
  name: string
  slug: string
  sku: string | null
  brandName: string | null
  categoryPath: string
  priceCents: number
  listPriceCents: number | null
  // Thumbnail of the main image (lowest order), or `null` without images.
  mainImageUrl: string | null
  isActive: boolean
  isFeatured: boolean
}

// One page of products; `totalPages` is `ceil(total / pageSize)`.
export interface ProductPageDTO {
  items: ProductListItemDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
