import {
  AbstractDomainEvent,
  ResolvedDomainEventProps,
  Result,
} from '@mentoria-360/shared'
import { OrderPaymentMethod } from '../errors'
import { ORDER_AGGREGATE_TYPE } from './order-placed.event'
import {
  ORDER_STATUS_EVENT_TYPES,
  OrderStepEventInput,
  OrderStepPayload,
  orderStepPayload,
} from './order-step.event'

export type OrderPaymentApprovedPayload = OrderStepPayload & {
  // Id of the transaction at the payment gateway.
  transactionId: string
  paymentMethod: OrderPaymentMethod
  // The total of the order, in cents, as approved.
  amountCents: number
}

export interface OrderPaymentApprovedEventInput extends OrderStepEventInput {
  transactionId: string
  paymentMethod: OrderPaymentMethod
  amountCents: number
}

/**
 * `order.payment-approved`: a fact already consumed, "the payment of the order
 * was approved".
 *
 * Added by `Order.approvePayment` (never when an order is rehydrated), stored in
 * the same transaction of the step through `DomainEventRepository.append` and
 * published afterwards by the outbox, with the routing key equal to `type`. The
 * next simulated service (the store, which starts picking) reacts to it.
 *
 * `occurredAt` is `changedAt` (the date of the step) and `metadata` is empty:
 * causation and correlation are filled by the outbox when the event is born
 * inside a consumer. Beyond the common part, the payload carries what the
 * gateway reports (`transactionId`, `paymentMethod`) and the amount approved,
 * which is the total of the order.
 */
export class OrderPaymentApprovedEvent extends AbstractDomainEvent<OrderPaymentApprovedPayload> {
  private constructor(
    props: ResolvedDomainEventProps<
      OrderPaymentApprovedPayload,
      Record<string, unknown>
    >,
  ) {
    super(props)
  }

  static tryCreate(
    input: OrderPaymentApprovedEventInput,
  ): Result<OrderPaymentApprovedEvent> {
    // `toISOString` throws for an invalid date; the failure becomes a Result.
    return Result.try(() =>
      super.tryCreateFromProps(
        {
          type: ORDER_STATUS_EVENT_TYPES.PAYMENT_APPROVED,
          aggregateType: ORDER_AGGREGATE_TYPE,
          aggregateId: input.orderId,
          occurredAt: input.changedAt,
          payload: {
            ...orderStepPayload(input, 'PAYMENT_APPROVED'),
            transactionId: input.transactionId,
            paymentMethod: input.paymentMethod,
            amountCents: input.amountCents,
          },
          metadata: {},
        },
        (props) => new OrderPaymentApprovedEvent(props),
      ),
    )
  }

  static create(
    input: OrderPaymentApprovedEventInput,
  ): OrderPaymentApprovedEvent {
    const result = OrderPaymentApprovedEvent.tryCreate(input)
    result.validator.throwsIfFailed()
    return result.instance
  }
}
