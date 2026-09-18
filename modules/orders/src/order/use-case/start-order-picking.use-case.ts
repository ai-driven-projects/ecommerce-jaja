import { Result } from '@mentoria-360/shared'
import { StartOrderPickingInputDTO } from '../dto'
import { OrderStepStatus } from '../event'
import { Order } from '../model'
import { OrderStepUseCase } from './order-step.use-case'

/**
 * The store started picking the items: the order advances to `PICKING` and
 * records `order.picking-started` with the picking list and the quantity of
 * units, in the same transaction.
 *
 * Called by the simulated store (`store.start-picking`), which reacts to
 * `order.payment-approved`. Fails with `ORDER_PICKING_DATA_INVALID` for a blank
 * picking list or one longer than 64 characters; an order whose payment is not
 * approved yet fails with `ORDER_STATUS_TRANSITION_INVALID`, except when the
 * picking had already started, which ends with `changed: false`.
 */
export class StartOrderPicking extends OrderStepUseCase<StartOrderPickingInputDTO> {
  protected get status(): OrderStepStatus {
    return 'PICKING'
  }

  protected applyTo(
    order: Order,
    input: StartOrderPickingInputDTO,
  ): Result<Order> {
    return order.startPicking({ pickingListId: input.pickingListId })
  }
}
