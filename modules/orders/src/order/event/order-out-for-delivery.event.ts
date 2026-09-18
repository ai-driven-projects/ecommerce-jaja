import {
  AbstractDomainEvent,
  ResolvedDomainEventProps,
  Result,
} from '@mentoria-360/shared'
import { ORDER_AGGREGATE_TYPE } from './order-placed.event'
import {
  ORDER_STATUS_EVENT_TYPES,
  OrderStepEventInput,
  OrderStepPayload,
  orderStepPayload,
} from './order-step.event'

export type OrderOutForDeliveryPayload = OrderStepPayload & {
  // Name of the courier who left with the order.
  courierName: string
  // Code the customer uses to follow the delivery.
  trackingCode: string
  // ISO 8601 text, never before `changedAt`.
  estimatedDeliveryAt: string
}

export interface OrderOutForDeliveryEventInput extends OrderStepEventInput {
  courierName: string
  trackingCode: string
  estimatedDeliveryAt: Date
}

/**
 * `order.out-for-delivery`: a fact already consumed, "a courier left with the
 * order".
 *
 * Added by `Order.dispatch` (never when an order is rehydrated), stored in the
 * same transaction of the step through `DomainEventRepository.append` and
 * published afterwards by the outbox, with the routing key equal to `type`. The
 * next simulated service (the delivery, which completes the order) reacts to it.
 *
 * `occurredAt` is `changedAt` (the date of the step) and `metadata` is empty:
 * causation and correlation are filled by the outbox when the event is born
 * inside a consumer. Beyond the common part, the payload carries what the
 * delivery reports: the courier, the tracking code and when the order is
 * expected to arrive.
 */
export class OrderOutForDeliveryEvent extends AbstractDomainEvent<OrderOutForDeliveryPayload> {
  private constructor(
    props: ResolvedDomainEventProps<
      OrderOutForDeliveryPayload,
      Record<string, unknown>
    >,
  ) {
    super(props)
  }

  static tryCreate(
    input: OrderOutForDeliveryEventInput,
  ): Result<OrderOutForDeliveryEvent> {
    // `toISOString` throws for an invalid date; the failure becomes a Result.
    return Result.try(() =>
      super.tryCreateFromProps(
        {
          type: ORDER_STATUS_EVENT_TYPES.OUT_FOR_DELIVERY,
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: input.orderId,
          occurredAt: input.changedAt,
          payload: {
            ...orderStepPayload(input, 'OUT_FOR_DELIVERY'),
            courierName: input.courierName,
            trackingCode: input.trackingCode,
            estimatedDeliveryAt: input.estimatedDeliveryAt.toISOString(),
          },
          metadata: {},
        },
        (props) => new OrderOutForDeliveryEvent(props),
      ),
    )
  }

  static create(
    input: OrderOutForDeliveryEventInput,
  ): OrderOutForDeliveryEvent {
    const result = OrderOutForDeliveryEvent.tryCreate(input)
    result.validator.throwsIfFailed()
    return result.instance
  }
}
