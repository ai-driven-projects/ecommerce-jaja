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

export type OrderPickingStartedPayload = OrderStepPayload & {
  // Id of the picking list at the store.
  pickingListId: string
  // Sum of the quantities of every item of the order.
  itemCount: number
}

export interface OrderPickingStartedEventInput extends OrderStepEventInput {
  pickingListId: string
  itemCount: number
}

/**
 * `order.picking-started`: a fact already consumed, "the store started picking
 * the items of the order".
 *
 * Added by `Order.startPicking` (never when an order is rehydrated), stored in
 * the same transaction of the step through `DomainEventRepository.append` and
 * published afterwards by the outbox, with the routing key equal to `type`. The
 * next simulated service (the delivery, which dispatches the order) reacts to
 * it.
 *
 * `occurredAt` is `changedAt` (the date of the step) and `metadata` is empty:
 * causation and correlation are filled by the outbox when the event is born
 * inside a consumer. Beyond the common part, the payload carries the picking
 * list of the store and how many units it has to separate, read from the order.
 */
export class OrderPickingStartedEvent extends AbstractDomainEvent<OrderPickingStartedPayload> {
  private constructor(
    props: ResolvedDomainEventProps<
      OrderPickingStartedPayload,
      Record<string, unknown>
    >,
  ) {
    super(props)
  }

  static tryCreate(
    input: OrderPickingStartedEventInput,
  ): Result<OrderPickingStartedEvent> {
    // `toISOString` throws for an invalid date; the failure becomes a Result.
    return Result.try(() =>
      super.tryCreateFromProps(
        {
          type: ORDER_STATUS_EVENT_TYPES.PICKING,
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: input.orderId,
          occurredAt: input.changedAt,
          payload: {
            ...orderStepPayload(input, 'PICKING'),
            pickingListId: input.pickingListId,
            itemCount: input.itemCount,
          },
          metadata: {},
        },
        (props) => new OrderPickingStartedEvent(props),
      ),
    )
  }

  static create(
    input: OrderPickingStartedEventInput,
  ): OrderPickingStartedEvent {
    const result = OrderPickingStartedEvent.tryCreate(input)
    result.validator.throwsIfFailed()
    return result.instance
  }
}
