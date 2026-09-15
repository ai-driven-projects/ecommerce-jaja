import { Result } from '@mentoria-360/shared'
import { OrderCustomerDTO } from '../dto'

/**
 * The customer record of the user, as the order needs it: `customerId`,
 * `isActive`, the `name` of the linked user (the default recipient) and the
 * delivery address.
 *
 * - Only a record that is not deleted is returned. An **inactive** record is
 *   returned too (`isActive: false`): refusing it is a rule of `PlaceOrder`
 *   (`ORDER_CUSTOMER_INACTIVE`).
 * - The address has the fields stored in the record, with `complement: null`
 *   when there is none.
 * - Resolves to `null` when the user has no customer record, when the record is
 *   deleted or when `userId` is malformed (without going to the database).
 *
 * A dependency of the `PlaceOrder` command, not a read use case. The link with
 * `customers` and `users` belongs to the database: this module never imports
 * the customers package.
 */
export interface FindOrderCustomerByUserIdQuery {
  execute(userId: string): Promise<Result<OrderCustomerDTO | null>>
}
