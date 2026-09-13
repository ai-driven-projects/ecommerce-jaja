import { Result } from '@mentoria-360/shared'
import { BrandDTO } from '../dto'

// Resolves to `null` when the brand does not exist or is deleted.
export interface FindBrandByIdQuery {
  execute(id: string): Promise<Result<BrandDTO | null>>
}
