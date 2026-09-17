import {
  AbstractDomainEvent,
  ResolvedDomainEventProps,
  Result,
} from '@mentoria-360/shared'
import { OrderErrors, OrderStatus } from '../errors'
import { ORDER_AGGREGATE_TYPE } from './order-placed.event'

/**
 * Event type of each status an order advances to. `PLACED` has no entry: it is
 * reached by placing the order, which records `order.placed`.
 */
export const ORDER_STATUS_EVENT_TYPES = {
  PAYMENT_APPROVED: 'order.payment-approved',
  PICKING: 'order.picking-started',
  OUT_FOR_DELIVERY: 'order.out-for-delivery',
  DELIVERED: 'order.delivered',
} as const

export type OrderStatusEventType =
  (typeof ORDER_STATUS_EVENT_TYPES)[keyof typeof ORDER_STATUS_EVENT_TYPES]

export type OrderStatusChangedPayload = {
  customerId: string
  // The status the order had before advancing.
  previousStatus: OrderStatus
  // The status reached.
  status: OrderStatus
  // ISO 8601 text, the same instant of `occurredAt`.
  changedAt: string
}

export interface OrderStatusChangedEventInput {
  // Id of the order.
  orderId: string
  customerId: string
  previousStatus: OrderStatus
  status: OrderStatus
  changedAt: Date
}

/**
 * A fact already consumed, "the order advanced to `<status>`", with one `type`
 * per status reached (`ORDER_STATUS_EVENT_TYPES`): `order.payment-approved`,
 * `order.picking-started`, `order.out-for-delivery` or `order.delivered`.
 *
 * Added by `Order.advanceTo` (never when an order is rehydrated), stored in the
 * same transaction of the status change through `DomainEventRepository.append`
 * and published afterwards by the outbox, with the routing key equal to `type`.
 * The next simulated service reacts to it.
 *
 * `occurredAt` is `changedAt` (the date of the step) and `metadata` is empty:
 * causation and correlation are filled by the outbox when the event is born
 * inside a consumer. The payload carries no order data beyond the customer and
 * the statuses; a consumer that needs more reads the order.
 *
 * A single class for the four steps: the consumers subscribe by routing key, so
 * each step still has its own event type and queue.
 */
export class OrderStatusChangedEvent extends AbstractDomainEvent<OrderStatusChangedPayload> {
  private constructor(
    props: ResolvedDomainEventProps<
      OrderStatusChangedPayload,
      Record<string, unknown>
    >,
  ) {
    super(props)
  }

  // Fails with `ORDER_STATUS_INVALID` for `PLACED` or an unknown status.
  static tryCreate(
    input: OrderStatusChangedEventInput,
  ): Result<OrderStatusChangedEvent> {
    const status = input?.status
    if (!isStatusWithEvent(status)) {
      return Result.fail(OrderErrors.ORDER_STATUS_INVALID)
    }

    // `toISOString` throws for an invalid date; the failure becomes a Result.
    return Result.try(() => {
      const payload: OrderStatusChangedPayload = {
        customerId: input.customerId,
        previousStatus: input.previousStatus,
        status,
        changedAt: input.changedAt.toISOString(),
      }

      return super.tryCreateFromProps(
        {
          type: ORDER_STATUS_EVENT_TYPES[status],
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: input.orderId,
          occurredAt: input.changedAt,
          payload,
          metadata: {},
        },
        (props) => new OrderStatusChangedEvent(props),
      )
    })
  }

  static create(input: OrderStatusChangedEventInput): OrderStatusChangedEvent {
    const result = OrderStatusChangedEvent.tryCreate(input)
    result.validator.throwsIfFailed()
    return result.instance
  }
}

// A status reached by advancing, which has an event type of its own.
function isStatusWithEvent(
  value: unknown,
): value is keyof typeof ORDER_STATUS_EVENT_TYPES {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ORDER_STATUS_EVENT_TYPES, value)
  )
}
