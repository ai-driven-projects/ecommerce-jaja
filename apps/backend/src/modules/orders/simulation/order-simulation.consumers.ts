import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvanceOrderStatus, OrderErrors } from '@jaja/orders';
import { Result } from '@mentoria-360/shared';
import type { BrokerMessage, TransactionManager } from '@mentoria-360/shared';
import type { TransactionalEventConsumer } from '../../../messaging/consumer/event-consumer.js';
import { EventConsumerRegistry } from '../../../messaging/consumer/event-consumer.registry.js';
import { DomainEventPrisma } from '../../../messaging/outbox/domain-event.prisma.js';
import { OrderPrisma } from '../order.prisma.js';
import { ORDER_SIMULATION_STEPS, OrderSimulationStep } from './order-simulation.steps.js';

const DEFAULT_DELAY_FACTOR = 1;
const MAX_DELAY_FACTOR = 10;
// The limit of `delayMs` accepted by `EventConsumerRegistry`.
const MAX_DELAY_MS = 300_000;

/**
 * Simulated services of the order (payment, picking at the store, delivery),
 * registered as event consumers in `onModuleInit` (before the runner subscribes
 * them). Each consumer reacts to the event of the previous step, waits
 * `delayMs` in the broker (queue `.wait`, never a `setTimeout` holding the
 * transaction) and calls `AdvanceOrderStatus` with the transaction of the
 * consumer, so the new status, its event and the "processed" mark are committed
 * together. The event stored gets the `causationId`/`correlationId` of the
 * message from the outbox, which chains the events of the order.
 *
 * Didactic simplification: in a real system each service would be a process of
 * its own, with events of its own (e.g. the payment gateway would publish
 * `payment.approved`, and the order would react to it by advancing its status).
 * Here the services live in the backend and advance the order directly.
 *
 * Settings:
 * - `ORDER_SIMULATION_ENABLED`: `"false"` registers no consumer (orders stay
 *   `PLACED`); any other value, or missing, enables the simulation;
 * - `ORDER_SIMULATION_DELAY_FACTOR`: multiplies the base wait of each service
 *   (finite number from 0 to 10; missing or invalid falls back to 1).
 */
@Injectable()
export class OrderSimulationConsumers implements OnModuleInit {
  private readonly logger = new Logger(OrderSimulationConsumers.name);
  private readonly enabled: boolean;
  private readonly delayFactor: number;

  constructor(
    private readonly registry: EventConsumerRegistry,
    private readonly orderPrisma: OrderPrisma,
    private readonly domainEventPrisma: DomainEventPrisma,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('ORDER_SIMULATION_ENABLED')?.trim() !== 'false';
    this.delayFactor = readDelayFactor(config.get<string>('ORDER_SIMULATION_DELAY_FACTOR'));
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Simulação de pedidos desligada (ORDER_SIMULATION_ENABLED=false)');
      return;
    }

    const consumers = ORDER_SIMULATION_STEPS.map((step) => this.consumerOf(step));
    for (const consumer of consumers) this.registry.register(consumer);

    const waits = consumers.map(({ name, delayMs }) => `${name} ${delayMs} ms`).join(', ');
    this.logger.log(`Simulação de pedidos ligada (fator ${this.delayFactor}): ${waits}`);
  }

  private consumerOf(step: OrderSimulationStep): TransactionalEventConsumer {
    return {
      name: step.consumerName,
      eventType: step.eventType,
      delayMs: Math.min(Math.round(step.baseDelayMs * this.delayFactor), MAX_DELAY_MS),
      handle: (message, transactionManager) => this.handle(step, message, transactionManager),
    };
  }

  // Only translates the message into the use case: the id of the order comes
  // from `payload.aggregateId` (set by the outbox for every event).
  private async handle(
    step: OrderSimulationStep,
    message: BrokerMessage,
    transactionManager: TransactionManager,
  ): Promise<Result<void>> {
    const orderId = message.payload?.aggregateId;
    if (typeof orderId !== 'string') return Result.fail(OrderErrors.ORDER_NOT_FOUND);

    const useCase = new AdvanceOrderStatus(
      this.orderPrisma,
      this.domainEventPrisma,
      transactionManager,
    );
    const result = await useCase.execute({ orderId, status: step.status });
    if (result.isFailure) return Result.fail(result.errors);

    const number = orderId.slice(0, 8).toUpperCase();
    if (result.instance.changed) {
      this.logger.log(`Pedido ${number} → ${step.status}`);
    } else {
      this.logger.debug(
        `Pedido ${number} já estava em ${result.instance.status}; ${step.consumerName} não alterou nada`,
      );
    }
    return Result.ok();
  }
}

// A finite number from 0 to 10; missing, blank or anything else is 1.
function readDelayFactor(value: string | undefined): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return DEFAULT_DELAY_FACTOR;

  const factor = Number(text);
  return Number.isFinite(factor) && factor >= 0 && factor <= MAX_DELAY_FACTOR
    ? factor
    : DEFAULT_DELAY_FACTOR;
}
