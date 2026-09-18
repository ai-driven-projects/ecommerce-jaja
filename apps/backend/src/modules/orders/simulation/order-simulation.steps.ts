import {
  ApproveOrderPayment,
  CompleteOrderDelivery,
  DispatchOrder,
  ORDER_PLACED_EVENT_TYPE,
  ORDER_STATUS_EVENT_TYPES,
  StartOrderPicking,
} from '@jaja/orders';
import type { OrderRepository, OrderStepOutputDTO } from '@jaja/orders';
import type {
  DomainEventRepository,
  Result,
  TransactionManager,
} from '@mentoria-360/shared';
import {
  SIMULATED_COURIER_NAME,
  simulatedEstimatedDeliveryAt,
  simulatedPickingListId,
  simulatedTrackingCode,
  simulatedTransactionId,
} from './order-simulation.data.js';

// The adapters a simulated service needs to conclude a step of the order. The
// transaction manager is the one of the consumer, so the writes join the
// transaction that marks the message as processed.
export interface OrderStepDependencies {
  readonly orderRepository: OrderRepository;
  readonly domainEventRepository: DomainEventRepository;
  readonly transactionManager: TransactionManager;
}

export interface OrderSimulationStep {
  // Name of the consumer (`<service>.<action>`): the queue is `jaja.<name>`.
  readonly consumerName: string;
  // Event of the previous step that the service reacts to.
  readonly eventType: string;
  // Wait of the service with `ORDER_SIMULATION_DELAY_FACTOR=1`, in ms.
  readonly baseDelayMs: number;
  // The service itself: builds the data it reports and calls the operation of
  // its step. It never chooses the status the order reaches — that is decided
  // by the domain.
  readonly execute: (
    dependencies: OrderStepDependencies,
    orderId: string,
  ) => Promise<Result<OrderStepOutputDTO>>;
}

/**
 * The simulated services of the order, in the order of the sequence. There is
 * no orchestrator (choreography): each service reacts to the event of the
 * previous step, waits (in the broker) and concludes its step of the order,
 * which records the event the next service reacts to.
 *
 * The table says **which service reacts to which event**; which status the
 * order reaches is a consequence of the operation, and is decided inside
 * `@jaja/orders`.
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
    baseDelayMs: 3_000,
    execute: (
      { orderRepository, domainEventRepository, transactionManager },
      orderId,
    ) =>
      new ApproveOrderPayment(
        orderRepository,
        domainEventRepository,
        transactionManager,
      ).execute({
        orderId,
        transactionId: simulatedTransactionId(orderId),
        paymentMethod: 'SIMULATED',
      }),
  },
  // Store: starts picking the items once the payment is approved.
  {
    consumerName: 'store.start-picking',
    eventType: ORDER_STATUS_EVENT_TYPES.PAYMENT_APPROVED,
    baseDelayMs: 2_000,
    execute: (
      { orderRepository, domainEventRepository, transactionManager },
      orderId,
    ) =>
      new StartOrderPicking(
        orderRepository,
        domainEventRepository,
        transactionManager,
      ).execute({
        orderId,
        pickingListId: simulatedPickingListId(orderId),
      }),
  },
  // Delivery: a courier leaves with the order once the picking has started.
  {
    consumerName: 'delivery.dispatch-order',
    eventType: ORDER_STATUS_EVENT_TYPES.PICKING,
    baseDelayMs: 6_000,
    execute: (
      { orderRepository, domainEventRepository, transactionManager },
      orderId,
    ) =>
      new DispatchOrder(
        orderRepository,
        domainEventRepository,
        transactionManager,
      ).execute({
        orderId,
        courierName: SIMULATED_COURIER_NAME,
        trackingCode: simulatedTrackingCode(orderId),
        estimatedDeliveryAt: simulatedEstimatedDeliveryAt(),
      }),
  },
  // Delivery: the courier hands the order to the customer. Without information
  // about who took it, the order records its own recipient.
  {
    consumerName: 'delivery.complete-order',
    eventType: ORDER_STATUS_EVENT_TYPES.OUT_FOR_DELIVERY,
    baseDelayMs: 8_000,
    execute: (
      { orderRepository, domainEventRepository, transactionManager },
      orderId,
    ) =>
      new CompleteOrderDelivery(
        orderRepository,
        domainEventRepository,
        transactionManager,
      ).execute({ orderId }),
  },
];
