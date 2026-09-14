import {
  Id,
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { CartItemDTO } from '../dto'
import { CART_ITEM_MAX_QUANTITY, CartErrors } from '../errors'

export interface CartItemProps {
  productId: string
  quantity: number
}

// A product with a quantity from 1 to `CART_ITEM_MAX_QUANTITY`. An item has no
// identity of its own: the cart list is always replaced as a whole, so two
// items with the same product and quantity are the same item. No price is
// stored: the lines always use the current catalog price.
export class CartItem extends ValueObject<CartItemProps, ValueObjectConfig> {
  private constructor(value: CartItemProps, config?: ValueObjectConfig) {
    super(Object.freeze({ ...value }), config)
  }

  static create(props: CartItemProps, config?: ValueObjectConfig): CartItem {
    const result = CartItem.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: CartItemProps,
    config?: ValueObjectConfig,
  ): Result<CartItem> {
    const input: Partial<CartItemProps> = props ?? {}
    // `Id.required` fails for a missing value instead of generating a uuid.
    const productId = Id.required(
      typeof input.productId === 'string' ? input.productId : '',
    )
    const quantity = CartItem.isValidQuantity(input.quantity)
      ? Result.ok()
      : Result.fail(CartErrors.CART_ITEM_QUANTITY_INVALID)

    const attrs = Result.combine([productId, quantity])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new CartItem(
        {
          productId: productId.instance.value,
          quantity: input.quantity as number,
        },
        resolveVoConfig(config),
      ),
    )
  }

  // An integer from 1 to `CART_ITEM_MAX_QUANTITY`; anything else (0, 100, 1.5,
  // text, missing) is invalid.
  static isValidQuantity(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= CART_ITEM_MAX_QUANTITY
    )
  }

  // Lowercase uuid.
  get productId(): string {
    return this.value.productId
  }

  get quantity(): number {
    return this.value.quantity
  }

  // New item of the same product with another quantity.
  withQuantity(quantity: number): Result<CartItem> {
    return CartItem.tryCreate({ ...this.value, quantity }, this.config)
  }

  equals(other: CartItem): boolean {
    return (
      this.productId === other.productId && this.quantity === other.quantity
    )
  }

  toProps(): CartItemProps {
    return { ...this.value }
  }

  toDTO(): CartItemDTO {
    return { productId: this.productId, quantity: this.quantity }
  }
}
