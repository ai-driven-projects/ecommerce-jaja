import { OrderPlacedEvent } from './order-placed.event'
import { OrderStatusChangedEvent } from './order-status-changed.event'

export * from './order-placed.event'
export * from './order-status-changed.event'

// Every event the order aggregate records.
export type OrderEvent = OrderPlacedEvent | OrderStatusChangedEvent
