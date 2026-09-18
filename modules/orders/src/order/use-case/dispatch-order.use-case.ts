import { Result } from '@mentoria-360/shared'
import { DispatchOrderInputDTO } from '../dto'
import { OrderStepStatus } from '../event'
import { Order } from '../model'
import { OrderStepUseCase } from './order-step.use-case'

/**
 * A courier left with the order: it advances to `OUT_FOR_DELIVERY` and records
 * `order.out-for-delivery` with the courier, the tracking code and the estimate
 * of arrival, in the same transaction.
 *
 * Called by the simulated delivery (`delivery.dispatch-order`), which reacts to
 * `order.picking-started`. Fails with `ORDER_DISPATCH_DATA_INVALID` for a
 * courier name outside 2 to 100 characters, a blank tracking code or one longer
 * than 64 characters, or an estimate that is not a valid date or is before the
 * moment of the step; an order that is not being picked fails with
 * `ORDER_STATUS_TRANSITION_INVALID`, except when it had already left, which
 * ends with `changed: false`.
 */
export class DispatchOrder extends OrderStepUseCase<DispatchOrderInputDTO> {
  protected get status(): OrderStepStatus {
    return 'OUT_FOR_DELIVERY'
  }

  protected applyTo(order: Order, input: DispatchOrderInputDTO): Result<Order> {
    return order.dispatch({
      courierName: input.courierName,
      trackingCode: input.trackingCode,
      estimatedDeliveryAt: input.estimatedDeliveryAt,
    })
  }
}
