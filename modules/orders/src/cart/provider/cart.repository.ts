import { CrudRepository, Result } from '@mentoria-360/shared'
import { Cart } from '../model'

// Soft-deleted carts (`deletedAt` set) are never returned by any lookup.
// `findById` fails with `CartErrors.CART_NOT_FOUND` when the cart is missing or
// deleted, and `delete` only fills `deletedAt`, keeping the record (it exists
// for the contract: no use case deletes carts). `userId` stays unique for
// deleted records too: `create` fails with `CART_ALREADY_EXISTS` for a used
// `userId`. The items are always stored as a whole, in the order of the entity.
export interface CartRepository extends CrudRepository<Cart> {
  // Resolves to `null` when the user has no cart yet (or it is deleted).
  findByUserId(userId: string): Promise<Result<Cart | null>>
}
