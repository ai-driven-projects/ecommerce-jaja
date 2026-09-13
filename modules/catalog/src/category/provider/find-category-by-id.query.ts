import { Result } from '@mentoria-360/shared'
import { CategoryDTO } from '../dto'

/**
 * Category with `level`, `path` and `childrenCount`. Resolves to `null` when
 * the category does not exist, is deleted or `id` is not a valid id (the API
 * answers `404 CATEGORY_NOT_FOUND`).
 */
export interface FindCategoryByIdQuery {
  execute(id: string): Promise<Result<CategoryDTO | null>>
}
