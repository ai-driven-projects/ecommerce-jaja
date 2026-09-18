import { OrderDeliveredEvent } from './order-delivered.event'
import { OrderOutForDeliveryEvent } from './order-out-for-delivery.event'
import { OrderPaymentApprovedEvent } from './order-payment-approved.event'
import { OrderPickingStartedEvent } from './order-picking-started.event'
import { OrderPlacedEvent } from './order-placed.event'

export * from './order-delivered.event'
export * from './order-out-for-delivery.event'
export * from './order-payment-approved.event'
export * from './order-picking-started.event'
export * from './order-placed.event'
export * from './order-step.event'

// Every event the order aggregate records: the order placed and the fact of
// each step of the cycle.
export type OrderEvent =
  | OrderPlacedEvent
  | OrderPaymentApprovedEvent
  | OrderPickingStartedEvent
  | OrderOutForDeliveryEvent
  | OrderDeliveredEvent
