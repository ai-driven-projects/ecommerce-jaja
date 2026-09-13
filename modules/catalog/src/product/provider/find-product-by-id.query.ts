import { Result } from '@mentoria-360/shared'
import { ProductDTO } from '../dto'

/**
 * Full product with `brandName`, `categoryPath` and the images ordered by
 * `order`. Resolves to `null` when the product does not exist or is deleted.
 */
export interface FindProductByIdQuery {
  execute(id: string): Promise<Result<ProductDTO | null>>
}
