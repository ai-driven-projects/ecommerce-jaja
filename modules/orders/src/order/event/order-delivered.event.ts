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

export type OrderDeliveredPayload = OrderStepPayload & {
  // Who took the order at the door; never blank. Without that information, the
  // recipient of the order.
  receivedBy: string
}

export interface OrderDeliveredEventInput extends OrderStepEventInput {
  receivedBy: string
}

/**
 * `order.delivered`: a fact already consumed, "the courier handed the order to
 * the customer". The last event of the cycle: no service reacts to it, and the
 * page of the customer closes the live stream when it arrives.
 *
 * Added by `Order.completeDelivery` (never when an order is rehydrated), stored
 * in the same transaction of the step through `DomainEventRepository.append`
 * and published afterwards by the outbox, with the routing key equal to `type`.
 *
 * `occurredAt` is `changedAt` (the date of the step) and `metadata` is empty:
 * causation and correlation are filled by the outbox when the event is born
 * inside a consumer. Beyond the common part, the payload carries who received
 * the order.
 */
export class OrderDeliveredEvent extends AbstractDomainEvent<OrderDeliveredPayload> {
  private constructor(
    props: ResolvedDomainEventProps<
      OrderDeliveredPayload,
      Record<string, unknown>
    >,
  ) {
    super(props)
  }

  static tryCreate(input: OrderDeliveredEventInput): Result<OrderDeliveredEvent> {
    // `toISOString` throws for an invalid date; the failure becomes a Result.
    return Result.try(() =>
      super.tryCreateFromProps(
        {
          type: ORDER_STATUS_EVENT_TYPES.DELIVERED,
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: input.orderId,
          occurredAt: input.changedAt,
          payload: {
            ...orderStepPayload(input, 'DELIVERED'),
            receivedBy: input.receivedBy,
          },
          metadata: {},
        },
        (props) => new OrderDeliveredEvent(props),
      ),
    )
  }

  static create(input: OrderDeliveredEventInput): OrderDeliveredEvent {
    const result = OrderDeliveredEvent.tryCreate(input)
    result.validator.throwsIfFailed()
    return result.instance
  }
}
