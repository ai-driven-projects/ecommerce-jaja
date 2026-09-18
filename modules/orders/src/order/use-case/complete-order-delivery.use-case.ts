import { Result } from '@mentoria-360/shared'
import { CompleteOrderDeliveryInputDTO } from '../dto'
import { OrderStepStatus } from '../event'
import { Order } from '../model'
import { OrderStepUseCase } from './order-step.use-case'

/**
 * The courier handed the order to the customer: it advances to `DELIVERED` and
 * records `order.delivered` with who received it, in the same transaction. It
 * is the last step of the cycle: no service reacts to its event.
 *
 * Called by the simulated delivery (`delivery.complete-order`), which reacts to
 * `order.out-for-delivery`. `receivedBy` is optional and resolves to the
 * recipient of the order; when informed, a name outside 2 to 100 characters
 * fails with `ORDER_DELIVERY_DATA_INVALID`. An order that has not left yet
 * fails with `ORDER_STATUS_TRANSITION_INVALID`, except when it had already been
 * delivered, which ends with `changed: false`.
 */
export class CompleteOrderDelivery extends OrderStepUseCase<CompleteOrderDeliveryInputDTO> {
  protected get status(): OrderStepStatus {
    return 'DELIVERED'
  }

  protected applyTo(
    order: Order,
    input: CompleteOrderDeliveryInputDTO,
  ): Result<Order> {
    return order.completeDelivery({ receivedBy: input.receivedBy })
  }
}
