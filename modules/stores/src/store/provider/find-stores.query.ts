import { Result } from '@mentoria-360/shared'
import { StoreFiltersDTO, StorePageDTO } from '../dto'

// One page of non-deleted stores. Without `search` they come ordered by name
// (ignoring case and accents); with `search`, every term must match the start
// of a word in the name, slug or reference address, and stores matching the
// name or slug come first. `isActive` filters by status when defined.
export interface FindStoresQuery {
  execute(filter: StoreFiltersDTO): Promise<Result<StorePageDTO>>
}
