import { Result } from '@mentoria-360/shared'
import { BrandFiltersDTO, BrandPageDTO } from '../dto'

// One page of non-deleted brands. Without `search` they come ordered by name
// (ignoring case and accents); with `search`, every term must match the start
// of a word in the name, slug or description, best matches first. `isActive`
// filters by status when defined.
export interface FindBrandsQuery {
  execute(filter: BrandFiltersDTO): Promise<Result<BrandPageDTO>>
}
