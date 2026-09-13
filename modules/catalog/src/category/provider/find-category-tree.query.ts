import { Result } from '@mentoria-360/shared'
import { CategoryTreeFilterDTO, CategoryTreePageDTO } from '../dto'

/**
 * One page of non-deleted **root** categories, shaped as a tree.
 *
 * - `total` and `totalPages` (`ceil(total / pageSize)`) count only the roots;
 *   a page past the last one returns `items: []`.
 * - With `expanded: true`, each root carries in `children` its non-deleted
 *   children and, inside them, its grandchildren (the full subtree, at most
 *   3 levels). With `expanded: false`, `children` is always `[]` and
 *   `childrenCount` tells whether there are children to load on demand
 *   (see `FindCategoryChildrenQuery`).
 * - At every level, siblings are ordered by `order` and, on ties, by `name`
 *   ignoring case and accents (with `id` as final tiebreaker for stable pages).
 * - Every node has `level`, `path` and `childrenCount`.
 */
export interface FindCategoryTreeQuery {
  execute(filter: CategoryTreeFilterDTO): Promise<Result<CategoryTreePageDTO>>
}
