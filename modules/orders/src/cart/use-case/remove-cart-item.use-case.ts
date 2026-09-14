import { Id, Result, UseCase } from '@mentoria-360/shared'
import { CartRepository } from '../provider'

export interface RemoveCartItemInput {
  // The authenticated user.
  userId: string
  productId: string
}

// Removes a product from the user's cart, available or not (no availability
// lookup). Idempotent: without a cart, or without the product in it, it ends
// ok without persisting. A malformed `productId` fails with the `Id` error.
export class RemoveCartItem implements UseCase<RemoveCartItemInput, void> {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(input: RemoveCartItemInput): Promise<Result<void>> {
    // `Id.required` fails for a missing value instead of generating a uuid.
    const userId = Id.required(
      typeof input.userId === 'string' ? input.userId : '',
    )
    if (userId.isFailure) return userId.withFail

    const productId = Id.required(
      typeof input.productId === 'string' ? input.productId : '',
    )
    if (productId.isFailure) return productId.withFail

    const existing = await this.cartRepository.findByUserId(
      userId.instance.value,
    )
    if (existing.isFailure) return existing.withFail

    const current = existing.instance
    if (!current || current.quantityOf(productId.instance.value) === 0) {
      return Result.ok()
    }

    const cart = current.removeItem(productId.instance.value)
    if (cart.isFailure) return cart.withFail
    return this.cartRepository.update(cart.instance)
  }
}
