import { Result } from '@mentoria-360/shared'
import { OrderDetailDTO } from '../dto'

/**
 * An order of the user, as shown on the tracking page and returned by
 * `POST /me/orders` and `GET /me/orders/:id`.
 *
 * - Only an order that is not deleted and whose customer record belongs to
 *   `userId` is returned: the filter is by the order id **and** by the user of
 *   the customer.
 * - Items come in the stored order (the order of the cart).
 * - The totals are read as stored when the order was placed, never recomputed
 *   with current catalog data.
 * - Resolves to `null` when the order does not exist, is deleted, belongs to
 *   another user or when any id is malformed (without going to the database).
 *   Callers must not tell these cases apart, so the id of another user's order
 *   is never revealed.
 *
 * Called directly by the controller, with no read use case.
 */
export interface FindMyOrderByIdQuery {
  execute(input: {
    userId: string
    orderId: string
  }): Promise<Result<OrderDetailDTO | null>>
}
