import { Result } from '@mentoria-360/shared'
import { CategoryTreeNodeDTO } from '../dto'

/**
 * Direct non-deleted children of `parentId`, without pagination.
 *
 * - Siblings are ordered like in `FindCategoryTreeQuery`: by `order` and, on
 *   ties, by `name` ignoring case and accents (then `id`).
 * - Each node has `level`, `path`, `childrenCount` and `children: []`.
 * - An existing parent without children resolves to `[]`.
 * - Resolves to `null` when the parent does not exist, is deleted or
 *   `parentId` is not a valid id (the API answers `404 CATEGORY_NOT_FOUND`).
 */
export interface FindCategoryChildrenQuery {
  execute(parentId: string): Promise<Result<CategoryTreeNodeDTO[] | null>>
}
