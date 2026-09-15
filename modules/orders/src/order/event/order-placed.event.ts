import {
  AbstractDomainEvent,
  ResolvedDomainEventProps,
  Result,
} from '@mentoria-360/shared'

export const ORDER_PLACED_EVENT_TYPE = 'order.placed'

export const ORDER_AGGREGATE_TYPE = 'Order'

// One frozen line of the order, as the consumers need it.
export type OrderPlacedItemPayload = {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export type OrderPlacedPayload = {
  customerId: string
  items: OrderPlacedItemPayload[]
  itemCount: number
  subtotalCents: number
  deliveryFeeCents: number
  totalCents: number
  // ISO 8601 text, the same instant of `occurredAt`.
  placedAt: string
}

export interface OrderPlacedEventInput {
  // Id of the order.
  orderId: string
  customerId: string
  items: OrderPlacedItemPayload[]
  itemCount: number
  subtotalCents: number
  deliveryFeeCents: number
  totalCents: number
  placedAt: Date
}

/**
 * `order.placed`: a fact already consumed, "the customer placed the order".
 *
 * Added by `Order.place` (never when an order is rehydrated), stored in the same
 * transaction of the order through `DomainEventRepository.append` and published
 * afterwards by the outbox, with the routing key equal to `type`.
 *
 * The payload carries enough for the consumers (payment, picking, delivery) to
 * never read the order: the customer, the frozen items and the totals. Address
 * and recipient stay out; a consumer that needs them reads the order.
 * `occurredAt` is the `placedAt` of the order and `metadata` is empty.
 */
export class OrderPlacedEvent extends AbstractDomainEvent<OrderPlacedPayload> {
  private constructor(
    props: ResolvedDomainEventProps<OrderPlacedPayload, Record<string, unknown>>,
  ) {
    super(props)
  }

  static tryCreate(input: OrderPlacedEventInput): Result<OrderPlacedEvent> {
    // `toISOString` throws for an invalid date; the failure becomes a Result.
    return Result.try(() =>
      super.tryCreateFromProps(
        {
          type: ORDER_PLACED_EVENT_TYPE,
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: input.orderId,
          occurredAt: input.placedAt,
          payload: {
            customerId: input.customerId,
            items: input.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              lineTotalCents: item.lineTotalCents,
            })),
            itemCount: input.itemCount,
            subtotalCents: input.subtotalCents,
            deliveryFeeCents: input.deliveryFeeCents,
            totalCents: input.totalCents,
            placedAt: input.placedAt.toISOString(),
          },
          metadata: {},
        },
        (props) => new OrderPlacedEvent(props),
      ),
    )
  }

  static create(input: OrderPlacedEventInput): OrderPlacedEvent {
    const result = OrderPlacedEvent.tryCreate(input)
    result.validator.throwsIfFailed()
    return result.instance
  }
}
