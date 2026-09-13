import { Result } from '@mentoria-360/shared'
import { StoreDTO } from '../dto'

// Resolves to `null` when the store does not exist or is deleted.
export interface FindStoreByIdQuery {
  execute(id: string): Promise<Result<StoreDTO | null>>
}
