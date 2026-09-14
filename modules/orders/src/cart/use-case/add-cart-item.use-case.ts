import { Id, Result, UseCase } from '@mentoria-360/shared'
import { CartErrors } from '../errors'
import { Cart, CartItem } from '../model'
import { CartRepository, FindAvailableProductIdsQuery } from '../provider'

export interface AddCartItemInput {
  // The authenticated user.
  userId: string
  productId: string
  quantity: number
}

// Adds `quantity` units of an available product to the user's cart (the
// "Adicionar" of the product page): a product already in the cart has the
// quantity summed, a new one enters at the end. The cart is created on the
// first item. A malformed `productId` or quantity fails before any lookup, and
// a product that is not available fails with `CART_PRODUCT_NOT_FOUND`.
export class AddCartItem implements UseCase<AddCartItemInput, void> {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly findAvailableProductIds: FindAvailableProductIdsQuery,
  ) {}

  async execute(input: AddCartItemInput): Promise<Result<void>> {
    // `Id.required` fails for a missing value instead of generating a uuid.
    const userId = Id.required(
      typeof input.userId === 'string' ? input.userId : '',
    )
    if (userId.isFailure) return userId.withFail

    const item = CartItem.tryCreate({
      productId: input.productId,
      quantity: input.quantity,
    })
    if (item.isFailure) return item.withFail
    const { productId, quantity } = item.instance

    const available = await this.findAvailableProductIds.execute([productId])
    if (available.isFailure) return available.withFail
    if (!available.instance.includes(productId)) {
      return Result.fail(CartErrors.CART_PRODUCT_NOT_FOUND)
    }

    const existing = await this.cartRepository.findByUserId(
      userId.instance.value,
    )
    if (existing.isFailure) return existing.withFail

    if (!existing.instance) {
      const cart = Cart.tryCreate({
        id: Id.createUUID(),
        userId: userId.instance.value,
        items: [item.instance.toProps()],
      })
      if (cart.isFailure) return cart.withFail
      return this.cartRepository.create(cart.instance)
    }

    const cart = existing.instance.addItem(productId, quantity)
    if (cart.isFailure) return cart.withFail
    return this.cartRepository.update(cart.instance)
  }
}
