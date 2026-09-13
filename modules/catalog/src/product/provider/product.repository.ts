import { CrudRepository, Result } from '@mentoria-360/shared'
import { Product } from '../model'

/**
 * Write-side persistence of products.
 *
 * - Soft-deleted products (`deletedAt` set) are never returned by any lookup
 *   and never counted by `existsBy*`.
 * - `findById` fails with `ProductErrors.PRODUCT_NOT_FOUND` when the product
 *   is missing or deleted.
 * - `create`/`update` persist the images as a whole: `update` replaces the
 *   stored list with the entity's list in the same transaction.
 * - `create`/`update` fail with `PRODUCT_SLUG_ALREADY_EXISTS` or
 *   `PRODUCT_SKU_ALREADY_EXISTS` when the value is already stored, deleted
 *   records included, and `create` fails with `PRODUCT_NOT_FOUND` when the id
 *   is already taken (e.g. saving with the id of a deleted product).
 * - `delete` only fills `deletedAt`, keeping the record (and its slug/sku reserved).
 */
export interface ProductRepository extends CrudRepository<Product> {
  /** Exact match on the slug; `null` when no non-deleted product uses it. */
  findBySlug(slug: string): Promise<Result<Product | null>>
  /** Exact match on the sku; `null` when no non-deleted product uses it. */
  findBySku(sku: string): Promise<Result<Product | null>>
  /** Whether a non-deleted product is directly linked to the brand. */
  existsByBrandId(brandId: string): Promise<Result<boolean>>
  /** Whether a non-deleted product is directly linked to the category (descendants are not considered). */
  existsByCategoryId(categoryId: string): Promise<Result<boolean>>
}
