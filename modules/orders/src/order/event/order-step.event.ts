import { OrderStatus } from '../errors'

/**
 * Event type of each status an order reaches by concluding a step. `PLACED` has
 * no entry: it is reached by placing the order, which records `order.placed`.
 *
 * The consumers subscribe by routing key, which is the `type` of the event, so
 * each step has its own event type and its own queue.
 */
export const ORDER_STATUS_EVENT_TYPES = {
  PAYMENT_APPROVED: 'order.payment-approved',
  PICKING: 'order.picking-started',
  OUT_FOR_DELIVERY: 'order.out-for-delivery',
  DELIVERED: 'order.delivered',
} as const

export type OrderStatusEventType =
  (typeof ORDER_STATUS_EVENT_TYPES)[keyof typeof ORDER_STATUS_EVENT_TYPES]

// The status of a step that has an event of its own (every one but `PLACED`).
export type OrderStepStatus = keyof typeof ORDER_STATUS_EVENT_TYPES

/**
 * What every step event of the order carries, whatever the step: the customer,
 * the statuses around the step and its date. Each event adds the data of its
 * own fact (the transaction of the payment, the picking list, the courier, who
 * received the order).
 *
 * `status` stays in the payload even though it can be read from `type`: the
 * monitor and the timeline read every event of the order the same way.
 */
export type OrderStepPayload = {
  customerId: string
  // The status the order had before the step.
  previousStatus: OrderStatus
  // The status reached by concluding the step.
  status: OrderStepStatus
  // ISO 8601 text, the same instant of `occurredAt`.
  changedAt: string
}

// What every step event needs, beyond the data of its own step.
export interface OrderStepEventInput {
  // Id of the order.
  orderId: string
  customerId: string
  previousStatus: OrderStatus
  changedAt: Date
}

/**
 * The common part of the payload. `toISOString` throws for an invalid date, so
 * it is always called inside the `Result.try` of the event.
 */
export function orderStepPayload(
  input: OrderStepEventInput,
  status: OrderStepStatus,
): OrderStepPayload {
  return {
    customerId: input.customerId,
    previousStatus: input.previousStatus,
    status,
    changedAt: input.changedAt.toISOString(),
  }
}
