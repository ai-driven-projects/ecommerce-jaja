// Node of the public storefront category tree (see
// `FindStorefrontCategoriesQuery`). `level`, `parentSlug` and `productCount`
// are computed by the read side and never persisted.
export interface StorefrontCategoryDTO {
  slug: string
  name: string
  // 1 = root, 2 = child, 3 = grandchild.
  level: number
  // `null` on a root.
  parentSlug: string | null
  isHighlighted: boolean
  // Visible products of the category and of all its descendants (always > 0).
  productCount: number
  // Ordered by `order`, then name ignoring case and accents (then `id`).
  children: StorefrontCategoryDTO[]
}
