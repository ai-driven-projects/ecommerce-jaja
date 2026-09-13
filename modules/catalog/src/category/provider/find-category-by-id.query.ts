import { Result } from '@mentoria-360/shared'
import { CategoryDTO } from '../dto'

/** Resolves to `null` when the category does not exist or is deleted. */
export interface FindCategoryByIdQuery {
  execute(id: string): Promise<Result<CategoryDTO | null>>
}
