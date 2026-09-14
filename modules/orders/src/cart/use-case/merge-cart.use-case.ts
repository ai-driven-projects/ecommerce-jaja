import { Id, Result, UseCase } from '@mentoria-360/shared'
import { CartItemInputDTO } from '../dto'
import { Cart } from '../model'
import { CartRepository, FindAvailableProductIdsQuery } from '../provider'

export interface MergeCartInput {
  // The authenticated user.
  userId: string
  // The guest cart built in the browser.
  items: CartItemInputDTO[]
}

// Merges the guest cart into the user's cart when they sign in or sign up.
// Never fails because of the items:
// 1. entries with a malformed `productId` or a quantity that is not an integer
//    >= 1 are discarded, and the quantities of a repeated product are summed
//    (limited to `CART_ITEM_MAX_QUANTITY`) — see `Cart.mergeableItems`;
// 2. the availability of every remaining product is checked in a **single**
//    lookup, and the unavailable ones are discarded;
// 3. without remaining items it ends ok without creating (or changing) a cart;
// 4. otherwise `Cart.merge` is applied to the user's cart, created when missing.
export class MergeCart implements UseCase<MergeCartInput, void> {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly findAvailableProductIds: FindAvailableProductIdsQuery,
  ) {}

  async execute(input: MergeCartInput): Promise<Result<void>> {
    // `Id.required` fails for a missing value instead of generating a uuid.
    const userId = Id.required(
      typeof input.userId === 'string' ? input.userId : '',
    )
    if (userId.isFailure) return userId.withFail

    const candidates = Cart.mergeableItems(input.items)
    if (candidates.length === 0) return Result.ok()

    const available = await this.findAvailableProductIds.execute(
      candidates.map((item) => item.productId),
    )
    if (available.isFailure) return available.withFail

    const availableIds = new Set(available.instance)
    const items = candidates.filter((item) => availableIds.has(item.productId))
    if (items.length === 0) return Result.ok()

    const existing = await this.cartRepository.findByUserId(
      userId.instance.value,
    )
    if (existing.isFailure) return existing.withFail

    if (!existing.instance) {
      const created = Cart.tryCreate({
        id: Id.createUUID(),
        userId: userId.instance.value,
      })
      if (created.isFailure) return created.withFail

      const cart = created.instance.merge(items)
      if (cart.isFailure) return cart.withFail
      return this.cartRepository.create(cart.instance)
    }

    const cart = existing.instance.merge(items)
    if (cart.isFailure) return cart.withFail
    return this.cartRepository.update(cart.instance)
  }
}
