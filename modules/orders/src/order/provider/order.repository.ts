import { CrudRepository } from '@mentoria-360/shared'
import { Order } from '../model'

// Soft-deleted orders (`deletedAt` set) are never returned by any lookup.
// `findById` fails with `OrderErrors.ORDER_NOT_FOUND` when the order is missing
// or deleted. `create` stores the order and its items in the same operation, in
// the order of the entity, and fails with `ORDER_ALREADY_EXISTS` for a used id.
// `update` and `delete` (which only fills `deletedAt`) exist for the contract:
// no use case changes or deletes orders in this delivery, and both fail with
// `ORDER_NOT_FOUND` for a missing or deleted order. Rehydrating never adds
// events.
export interface OrderRepository extends CrudRepository<Order> {}
