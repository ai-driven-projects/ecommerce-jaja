import { ORDER_PLACED_EVENT_TYPE, ORDER_STATUS_EVENT_TYPES } from '@jaja/orders';
import type { OrderStatus } from '@jaja/orders';

export interface OrderSimulationStep {
  // Name of the consumer (`<service>.<action>`): the queue is `jaja.<name>`.
  readonly consumerName: string;
  // Event of the previous step that the service reacts to.
  readonly eventType: string;
  // Status the order advances to.
  readonly status: Exclude<OrderStatus, 'PLACED'>;
  // Wait of the service with `ORDER_SIMULATION_DELAY_FACTOR=1`, in ms.
  readonly baseDelayMs: number;
}

/**
 * The simulated services of the order, in the order of the sequence. There is
 * no orchestrator (choreography): each service reacts to the event of the
 * previous step, waits (in the broker) and advances the order one step, which
 * records the event the next service reacts to.
 *
 * The prefix of each name is the simulated service, not `orders`, because each
 * one stands for an external system.
 */
export const ORDER_SIMULATION_STEPS: readonly OrderSimulationStep[] = [
  // Payment gateway: approves the payment of every order placed (there is no
  // payment data nor refusal in this version).
  {
    consumerName: 'payment.approve-order',
    eventType: ORDER_PLACED_EVENT_TYPE,
    status: 'PAYMENT_APPROVED',
    baseDelayMs: 3_000,
  },
  // Store: starts picking the items once the payment is approved.
  {
    consumerName: 'store.start-picking',
    eventType: ORDER_STATUS_EVENT_TYPES.PAYMENT_APPROVED,
    status: 'PICKING',
    baseDelayMs: 2_000,
  },
  // Delivery: a courier leaves with the order once the picking has started.
  {
    consumerName: 'delivery.dispatch-order',
    eventType: ORDER_STATUS_EVENT_TYPES.PICKING,
    status: 'OUT_FOR_DELIVERY',
    baseDelayMs: 6_000,
  },
  // Delivery: the courier hands the order to the customer.
  {
    consumerName: 'delivery.complete-order',
    eventType: ORDER_STATUS_EVENT_TYPES.OUT_FOR_DELIVERY,
    status: 'DELIVERED',
    baseDelayMs: 8_000,
  },
];
