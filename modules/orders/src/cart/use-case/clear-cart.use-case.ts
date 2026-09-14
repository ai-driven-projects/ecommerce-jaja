import { Id, Result, UseCase } from '@mentoria-360/shared'
import { CartRepository } from '../provider'

export interface ClearCartInput {
  // The authenticated user.
  userId: string
}

// Removes every item of the user's cart, keeping the cart. Idempotent: without
// a cart, or with an empty cart, it ends ok without persisting.
export class ClearCart implements UseCase<ClearCartInput, void> {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(input: ClearCartInput): Promise<Result<void>> {
    // `Id.required` fails for a missing value instead of generating a uuid.
    const userId = Id.required(
      typeof input.userId === 'string' ? input.userId : '',
    )
    if (userId.isFailure) return userId.withFail

    const existing = await this.cartRepository.findByUserId(
      userId.instance.value,
    )
    if (existing.isFailure) return existing.withFail

    const current = existing.instance
    if (!current || current.items.length === 0) return Result.ok()

    const cart = current.clear()
    if (cart.isFailure) return cart.withFail
    return this.cartRepository.update(cart.instance)
  }
}
