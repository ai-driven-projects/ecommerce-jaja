import { Result } from '@mentoria-360/shared'
import { OrderAdminDetailDTO } from '../dto'

/**
 * An order of any customer, for the admin order monitor (`GET /orders/:id` and
 * the check before `GET /orders/:id/events`).
 *
 * - Returns the order with its items in the stored order (the order of the
 *   cart), the delivery address, recipient, instructions and totals as stored,
 *   the status and the date of each step, `updatedAt` and the `customer`
 *   (`customers.id`, name and email of the linked user, phone of the record).
 * - Resolves to `null` when the order does not exist, is deleted or when
 *   `orderId` is malformed (not a uuid, without going to the database).
 *
 * Unlike `FindMyOrderByIdQuery`, it does not filter by user: only
 * administrators may call it. Called directly by the controller, with no read
 * use case.
 */
export interface FindOrderByIdQuery {
  execute(orderId: string): Promise<Result<OrderAdminDetailDTO | null>>
}
