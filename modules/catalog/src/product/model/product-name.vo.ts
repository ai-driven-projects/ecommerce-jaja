import { Text } from '@mentoria-360/shared'
import { ProductErrors } from '../errors'

// Product names are longer than the shared `Name` allows (up to 100): the
// Kalunga catalog has names with more than 200 characters. `Text` trims the
// value and reads the limits and codes below from the subclass.
export class ProductName extends Text {
  protected static readonly TOO_SHORT: string = ProductErrors.PRODUCT_NAME_TOO_SHORT
  protected static readonly TOO_LONG: string = ProductErrors.PRODUCT_NAME_TOO_LONG
  protected static readonly DEFAULT_MIN_LENGTH: number = 3
  protected static readonly DEFAULT_MAX_LENGTH: number = 255
}
