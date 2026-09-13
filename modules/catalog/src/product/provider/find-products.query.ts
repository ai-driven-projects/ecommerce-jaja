import { Result } from '@mentoria-360/shared'
import { ProductFiltersDTO, ProductPageDTO } from '../dto'

/**
 * Paginated list of non-deleted products.
 *
 * - Ordered by `name` ascending, with `id` as tiebreaker so pages are stable.
 * - `search` matches a case-insensitive fragment of `name`, `slug` or `sku`.
 * - `brandId` keeps only the products of that brand.
 * - `categoryId` keeps the products of that category and of all its
 *   descendant subcategories.
 * - `isActive` filters by status when defined.
 * - Filters are combined (all must match); `total` and `totalPages`
 *   (`ceil(total / pageSize)`) are computed over the filtered result, and a
 *   page past the last one returns `items: []`.
 */
export interface FindProductsQuery {
  execute(filter: ProductFiltersDTO): Promise<Result<ProductPageDTO>>
}
