import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderErrors } from '@jaja/orders';
import type { OrderProps } from '@jaja/orders';
import {
  BrokerMessage,
  DomainEvent,
  Result,
  TransactionContext,
  TransactionManager,
} from '@mentoria-360/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionalEventConsumer } from '../../../../src/messaging/consumer/event-consumer.js';
import type { EventConsumerRegistry } from '../../../../src/messaging/consumer/event-consumer.registry.js';
import type { DomainEventPrisma } from '../../../../src/messaging/outbox/domain-event.prisma.js';
import type { OrderPrisma } from '../../../../src/modules/orders/order.prisma.js';
import { OrderSimulationConsumers } from '../../../../src/modules/orders/simulation/order-simulation.consumers.js';

const ORDER_ID = 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d';
const PLACED_AT = new Date('2026-09-17T12:00:00.000Z');

function placedOrder(overrides: Partial<OrderProps> = {}): Order {
  return Order.create({
    id: ORDER_ID,
    customerId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    status: 'PLACED',
    items: [
      {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Banana prata',
        unit: 'kg',
        thumbUrl: null,
        unitPriceCents: 799,
        quantity: 2,
      },
    ],
    deliveryAddress: {
      zipCode: '60150160',
      street: 'Rua Silva Paulet',
      number: '1200',
      complement: null,
      neighborhood: 'Aldeota',
      city: 'Fortaleza',
      state: 'CE',
    },
    recipientName: 'Ana Pereira',
    deliveryInstructions: null,
    placedAt: PLACED_AT,
    createdAt: PLACED_AT,
    updatedAt: PLACED_AT,
    ...overrides,
  });
}

const PAYMENT_APPROVED_AT = new Date('2026-09-17T12:00:03.000Z');
const PICKING_STARTED_AT = new Date('2026-09-17T12:00:05.000Z');
const OUT_FOR_DELIVERY_AT = new Date('2026-09-17T12:00:11.000Z');

// A stored order that already concluded the steps before `status`, rehydrated
// as the adapter reads it: with the dates of the steps and without events.
function orderIn(status: 'PAYMENT_APPROVED' | 'PICKING' | 'OUT_FOR_DELIVERY'): Order {
  const dates: Record<typeof status, Partial<OrderProps>> = {
    PAYMENT_APPROVED: { paymentApprovedAt: PAYMENT_APPROVED_AT },
    PICKING: {
      paymentApprovedAt: PAYMENT_APPROVED_AT,
      pickingStartedAt: PICKING_STARTED_AT,
    },
    OUT_FOR_DELIVERY: {
      paymentApprovedAt: PAYMENT_APPROVED_AT,
      pickingStartedAt: PICKING_STARTED_AT,
      outForDeliveryAt: OUT_FOR_DELIVERY_AT,
    },
  };

  return placedOrder({ status, ...dates[status] });
}

function message(payload: Record<string, unknown>): BrokerMessage {
  return {
    messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
    type: 'order.placed',
    payload,
    metadata: {},
    occurredAt: PLACED_AT,
  };
}

// Records the registrations instead of validating them.
class FakeRegistry {
  readonly consumers: TransactionalEventConsumer[] = [];
  register(consumer: TransactionalEventConsumer): void {
    this.consumers.push(consumer);
  }
}

class FakeOrderPrisma {
  order: Order | null = placedOrder();
  readonly updates: { order: Order; tx?: TransactionContext }[] = [];

  async findById(): Promise<Result<Order>> {
    return this.order ? Result.ok(this.order) : Result.fail(OrderErrors.ORDER_NOT_FOUND);
  }

  async update(order: Order, tx?: TransactionContext): Promise<Result<void>> {
    this.updates.push({ order, tx });
    return Result.ok();
  }
}

class FakeDomainEventPrisma {
  readonly appends: { events: DomainEvent[]; tx?: TransactionContext }[] = [];
  async append(events: DomainEvent[], tx?: TransactionContext): Promise<Result<void>> {
    this.appends.push({ events, tx });
    return Result.ok();
  }
}

// The transaction manager handed to the consumer by the runner.
class FakeTransactionManager implements TransactionManager {
  readonly tx = { client: { name: 'consumer transaction' } } as unknown as TransactionContext;
  calls = 0;
  async runInTransaction<T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.calls += 1;
    return operation(this.tx);
  }
}

function setup(env: Record<string, string | undefined> = {}) {
  const registry = new FakeRegistry();
  const orderPrisma = new FakeOrderPrisma();
  const domainEvents = new FakeDomainEventPrisma();
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const simulation = new OrderSimulationConsumers(
    registry as unknown as EventConsumerRegistry,
    orderPrisma as unknown as OrderPrisma,
    domainEvents as unknown as DomainEventPrisma,
    config,
  );
  return { simulation, registry, orderPrisma, domainEvents };
}

describe('OrderSimulationConsumers', () => {
  let logged: { level: string; text: string }[];

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push({ level, text: args.map(String).join(' ') });
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const summary = (consumers: TransactionalEventConsumer[]) =>
    consumers.map(({ name, eventType, delayMs }) => ({ name, eventType, delayMs }));

  it('registers the four services with the names, events and waits of the table', () => {
    const { simulation, registry } = setup();

    simulation.onModuleInit();

    expect(summary(registry.consumers)).toEqual([
      { name: 'payment.approve-order', eventType: 'order.placed', delayMs: 3_000 },
      { name: 'store.start-picking', eventType: 'order.payment-approved', delayMs: 2_000 },
      { name: 'delivery.dispatch-order', eventType: 'order.picking-started', delayMs: 6_000 },
      { name: 'delivery.complete-order', eventType: 'order.out-for-delivery', delayMs: 8_000 },
    ]);
    const configLogs = logged.filter((line) => line.text.includes('Simulação de pedidos'));
    expect(configLogs).toHaveLength(1);
    expect(configLogs[0].text).toContain('fator 1');
  });

  it.each([
    { factor: '0.5', waits: [1_500, 1_000, 3_000, 4_000] },
    { factor: '0', waits: [0, 0, 0, 0] },
    { factor: '0.2', waits: [600, 400, 1_200, 1_600] },
    { factor: '10', waits: [30_000, 20_000, 60_000, 80_000] },
  ])('applies the delay factor $factor', ({ factor, waits }) => {
    const { simulation, registry } = setup({ ORDER_SIMULATION_DELAY_FACTOR: factor });

    simulation.onModuleInit();

    expect(registry.consumers.map((consumer) => consumer.delayMs)).toEqual(waits);
  });

  it.each(['abc', '-1', '10.5', 'Infinity', 'NaN', ''])(
    'falls back to the factor 1 for the invalid value "%s"',
    (factor) => {
      const { simulation, registry } = setup({ ORDER_SIMULATION_DELAY_FACTOR: factor });

      simulation.onModuleInit();

      expect(registry.consumers.map((consumer) => consumer.delayMs)).toEqual([
        3_000, 2_000, 6_000, 8_000,
      ]);
    },
  );

  it('registers nothing when ORDER_SIMULATION_ENABLED is "false"', () => {
    const { simulation, registry } = setup({ ORDER_SIMULATION_ENABLED: 'false' });

    simulation.onModuleInit();

    expect(registry.consumers).toHaveLength(0);
    expect(logged.filter((line) => line.text.includes('desligada'))).toHaveLength(1);
  });

  it.each([{ payload: {} }, { payload: { aggregateId: 42 } }])(
    'fails with ORDER_NOT_FOUND when the message has no textual aggregateId ($payload)',
    async ({ payload }) => {
      const { simulation, registry, orderPrisma } = setup();
      simulation.onModuleInit();
      const transactionManager = new FakeTransactionManager();

      const result = await registry.consumers[0].handle(message(payload), transactionManager);

      expect(result.errors).toEqual([OrderErrors.ORDER_NOT_FOUND]);
      expect(orderPrisma.updates).toHaveLength(0);
      expect(transactionManager.calls).toBe(0);
    },
  );

  it('concludes the step of the payment with the received transaction manager', async () => {
    const { simulation, registry, orderPrisma, domainEvents } = setup();
    simulation.onModuleInit();
    const transactionManager = new FakeTransactionManager();

    const result = await registry.consumers[0].handle(
      message({ aggregateType: 'Order', aggregateId: ORDER_ID }),
      transactionManager,
    );

    expect(result.isOk).toBe(true);
    expect(result.instance ?? null).toBeNull();
    expect(transactionManager.calls).toBe(1);
    expect(orderPrisma.updates).toHaveLength(1);
    const order = orderPrisma.updates[0].order;
    expect(order.status).toBe('PAYMENT_APPROVED');
    expect(orderPrisma.updates[0].tx).toBe(transactionManager.tx);
    expect(domainEvents.appends).toHaveLength(1);
    expect(domainEvents.appends[0].tx).toBe(transactionManager.tx);
    const event = domainEvents.appends[0].events[0];
    expect(event.type).toBe('order.payment-approved');
    // The data of the gateway is derived from the id of the order.
    expect(event.payload).toMatchObject({
      transactionId: 'TX-C7B8A3D2',
      paymentMethod: 'SIMULATED',
      amountCents: order.totalCents,
    });
    expect(logged.some((line) => line.text === 'Pedido C7B8A3D2 → PAYMENT_APPROVED')).toBe(true);
  });

  it.each([
    {
      step: 'store.start-picking',
      index: 1,
      stored: 'PAYMENT_APPROVED' as const,
      status: 'PICKING',
      type: 'order.picking-started',
      data: { pickingListId: 'SEP-C7B8A3D2', itemCount: 2 },
    },
    {
      step: 'delivery.dispatch-order',
      index: 2,
      stored: 'PICKING' as const,
      status: 'OUT_FOR_DELIVERY',
      type: 'order.out-for-delivery',
      data: { courierName: 'Entregador Simulado', trackingCode: 'JAJA-C7B8A3D2' },
    },
    {
      step: 'delivery.complete-order',
      index: 3,
      stored: 'OUT_FOR_DELIVERY' as const,
      status: 'DELIVERED',
      type: 'order.delivered',
      // Without information about who took it, the recipient of the order.
      data: { receivedBy: 'Ana Pereira' },
    },
  ])('$step concludes its step with the simulated data', async ({ index, stored, status, type, data }) => {
    const { simulation, registry, orderPrisma, domainEvents } = setup();
    simulation.onModuleInit();
    orderPrisma.order = orderIn(stored);
    const transactionManager = new FakeTransactionManager();

    const result = await registry.consumers[index].handle(
      message({ aggregateType: 'Order', aggregateId: ORDER_ID }),
      transactionManager,
    );

    expect(result.isOk).toBe(true);
    expect(orderPrisma.updates[0].order.status).toBe(status);
    const event = domainEvents.appends[0].events[0];
    expect(event.type).toBe(type);
    expect(event.payload).toMatchObject(data);
    expect(logged.some((line) => line.text === `Pedido C7B8A3D2 → ${status}`)).toBe(true);
  });

  it('promises the delivery for 15 minutes after the dispatch', async () => {
    const { simulation, registry, orderPrisma, domainEvents } = setup();
    simulation.onModuleInit();
    orderPrisma.order = orderIn('PICKING');
    const before = Date.now();

    await registry.consumers[2].handle(
      message({ aggregateType: 'Order', aggregateId: ORDER_ID }),
      new FakeTransactionManager(),
    );

    const { estimatedDeliveryAt } = domainEvents.appends[0].events[0].payload as {
      estimatedDeliveryAt: string;
    };
    const promised = new Date(estimatedDeliveryAt).getTime();
    expect(promised).toBeGreaterThanOrEqual(before + 15 * 60_000);
    expect(promised).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
  });

  it('ends with success and only a debug log when the step was already concluded', async () => {
    const { simulation, registry, orderPrisma } = setup();
    simulation.onModuleInit();
    orderPrisma.order = orderIn('PAYMENT_APPROVED');
    const transactionManager = new FakeTransactionManager();

    const result = await registry.consumers[0].handle(
      message({ aggregateType: 'Order', aggregateId: ORDER_ID }),
      transactionManager,
    );

    expect(result.isOk).toBe(true);
    expect(transactionManager.calls).toBe(0);
    expect(orderPrisma.updates).toHaveLength(0);
    expect(logged.some((line) => line.level === 'debug' && line.text.includes('C7B8A3D2'))).toBe(
      true,
    );
  });

  it('returns the failure of the operation', async () => {
    const { simulation, registry, orderPrisma } = setup();
    simulation.onModuleInit();
    orderPrisma.order = null;

    const result = await registry.consumers[0].handle(
      message({ aggregateType: 'Order', aggregateId: ORDER_ID }),
      new FakeTransactionManager(),
    );

    expect(result.errors).toEqual([OrderErrors.ORDER_NOT_FOUND]);
  });
});
