import { CrudRepository, Result } from '@mentoria-360/shared'
import { Category } from '../model'

/**
 * Write-side persistence of categories.
 *
 * - Soft-deleted categories (`deletedAt` set) are never returned by any lookup.
 * - `findById` fails with `CategoryErrors.CATEGORY_NOT_FOUND` when the category
 *   is missing or deleted.
 * - `delete` only fills `deletedAt`, keeping the record (and its slug reserved).
 * - `create`/`update` fail with `CategoryErrors.CATEGORY_SLUG_ALREADY_EXISTS`
 *   when the slug is already stored, deleted records included.
 */
export interface CategoryRepository extends CrudRepository<Category> {
  /** Exact match on the slug; `null` when no non-deleted category uses it. */
  findBySlug(slug: string): Promise<Result<Category | null>>
  /** Direct children of `parentId`; `null` lists the root categories. */
  findByParentId(parentId: string | null): Promise<Result<Category[]>>
  /** Every non-deleted category, without pagination. */
  findAll(): Promise<Result<Category[]>>
}
