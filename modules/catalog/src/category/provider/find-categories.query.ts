import { Result } from '@mentoria-360/shared'
import { CategoryFiltersDTO, CategoryPageDTO } from '../dto'

/**
 * One page of non-deleted categories of any level, each with `level`, `path`
 * and `childrenCount`.
 *
 * - Without `search`, ordered by `path` ignoring case and accents (with `id`
 *   as tiebreaker so pages are stable).
 * - `search` works like the brand search: the text is split into terms,
 *   accents and case are ignored and every term must match the start of a
 *   word in the name, slug or description. Categories matching on name or
 *   slug come before those matching only on description (then `path` order).
 *   A text without letters or digits is treated as no search.
 * - `isActive` filters by status when defined.
 * - `maxLevel` keeps only categories with `level <= maxLevel`.
 * - `excludeSubtreeOf` removes that category and all its descendants.
 * - Filters are combined (all must match). `level` and `path` always consider
 *   every ancestor, even one that does not pass the filters.
 * - `total` and `totalPages` (`ceil(total / pageSize)`) are computed over the
 *   filtered result, and a page past the last one returns `items: []`.
 */
export interface FindCategoriesQuery {
  execute(filter: CategoryFiltersDTO): Promise<Result<CategoryPageDTO>>
}
