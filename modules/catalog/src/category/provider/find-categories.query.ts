import { Result } from '@mentoria-360/shared'
import { CategoryDTO, CategoryFiltersDTO } from '../dto'

/**
 * Flat list of every non-deleted category, without pagination, ordered by
 * `path`. `level` and `path` always consider all ancestors, and `isActive`
 * (when defined) is applied only after they are computed, so a filtered
 * category keeps the path of an ancestor that did not pass the filter.
 */
export interface FindCategoriesQuery {
  execute(filter: CategoryFiltersDTO): Promise<Result<CategoryDTO[]>>
}
