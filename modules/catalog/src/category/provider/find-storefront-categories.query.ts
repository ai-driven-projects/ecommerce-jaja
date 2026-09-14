import { Result } from '@mentoria-360/shared'
import { StorefrontCategoryDTO } from '../dto'

/**
 * Public category tree of the storefront, without pagination: the root
 * categories with their full subtree in `children` (at most 3 levels).
 *
 * - Only active, non-deleted categories are included; a child of an inactive
 *   or deleted category is left out together with its whole subtree.
 * - `productCount` counts the visible products of the category and of all its
 *   descendants. A product is visible when it is not deleted, is active and
 *   its category and **all** ancestor categories are active and not deleted
 *   (the same rule in every storefront query; the brand status does not
 *   matter).
 * - Categories with `productCount = 0` are omitted.
 * - At every level, siblings are ordered by `order`, then by `name` ignoring
 *   case and accents, then by `id`.
 * - Each node has `level` (1 = root, 2 = child, 3 = grandchild) and
 *   `parentSlug` (`null` on a root).
 */
export interface FindStorefrontCategoriesQuery {
  execute(): Promise<Result<StorefrontCategoryDTO[]>>
}
