import { Text } from '@mentoria-360/shared'
import { ProductErrors } from '../errors'

// Optional long text of a product: create it with `{ optional: true }` so a
// missing or blank description resolves to `null`.
export class ProductDescription extends Text {
  protected static readonly TOO_LONG: string =
    ProductErrors.PRODUCT_DESCRIPTION_TOO_LONG
  protected static readonly DEFAULT_MAX_LENGTH: number = 5000
}
