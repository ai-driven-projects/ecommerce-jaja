/**
 * Integration test of the order lifecycle against the real Postgres and RabbitMQ:
 * outbox → RabbitMQ → simulated services → `AdvanceOrderStatus` → outbox → …
 * until the order is `DELIVERED`, with the live notices of the order.
 *
 * Runs only with `MESSAGING_E2E=true`; otherwise it is skipped, so
 * `npm run test:e2e` keeps working without a broker. Prerequisites:
 * - the `postgres` and `rabbitmq` services of `docker-compose.yml` running
 *   (`npm run db:start` and `npm run broker:start` in `@jaja/backend`);
 * - the migrations applied (`npm run prisma:migrate:deploy`) and the seeds
 *   `auth`, `customers` and `catalog` applied
 *   (`npm run prisma:seed -- --only=auth,customers,catalog`);
 * - no backend running (`npm run dev` or another instance): its relay and its
 *   simulated services would compete with the test for the pending rows and the
 *   messages of the work queues (with their own waits).
 *
 * Then: `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend`.
 * The test places one order for the seed customer `ana.pereira.carvalho@jaja.dev`
 * straight through the domain (no HTTP, the cart is not touched) and, at the
 * end, deletes the `processed_messages` and `outbox_events` rows of that order
 * and the order itself (items by cascade).
 */
import { randomUUID } from 'node:crypto';
import { INestApplication, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  Order,
  ORDER_PLACED_EVENT_TYPE,
  ORDER_STATUS_EVENT_TYPES,
} from '@jaja/orders';
import { DomainEventStatus } from '@mentoria-360/shared';
import amqp from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import type { Subscription } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/db/prisma.service.js';
import { LiveEventFeed } from '../src/messaging/live/live-event-feed.js';
import { DomainEventPrisma } from '../src/messaging/outbox/domain-event.prisma.js';
import { OrderLiveUpdates } from '../src/modules/orders/order-live-updates.js';
import { OrderPrisma } from '../src/modules/orders/order.prisma.js';
import { SIMULATED_COURIER_NAME } from '../src/modules/orders/simulation/order-simulation.data.js';
import { ORDER_SIMULATION_STEPS } from '../src/modules/orders/simulation/order-simulation.steps.js';

const CUSTOMER_EMAIL = 'ana.pereira.carvalho@jaja.dev';
const LIFECYCLE_TIMEOUT_MS = 20_000;
const SETUP_TIMEOUT_MS = LIFECYCLE_TIMEOUT_MS + 20_000;
const EVENT_TYPES = [
  ORDER_PLACED_EVENT_TYPE,
  ORDER_STATUS_EVENT_TYPES.PAYMENT_APPROVED,
  ORDER_STATUS_EVENT_TYPES.PICKING,
  ORDER_STATUS_EVENT_TYPES.OUT_FOR_DELIVERY,
  ORDER_STATUS_EVENT_TYPES.DELIVERED,
];
const PROBE_EVENT_TYPE = 'messaging.test-live-probe';

async function waitFor<T>(
  description: string,
  probe: () => Promise<T | null | undefined>,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${description}`);
}

describe.runIf(process.env.MESSAGING_E2E === 'true')(
  'Order lifecycle (e2e)',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let brokerConnection: ChannelModel | undefined;
    let brokerChannel: Channel;
    let streamSubscription: Subscription | undefined;
    let orderId: string | undefined;
    const notices: MessageEvent[] = [];

    const outboxOf = (id: string) =>
      prisma.client.outboxEvent.findMany({
        where: { aggregateType: 'Order', aggregateId: id },
        orderBy: { occurredAt: 'asc' },
      });

    async function deleteTestRows(): Promise<void> {
      if (!prisma || !orderId) return;
      const events = await outboxOf(orderId);
      await prisma.client.processedMessage.deleteMany({
        where: { messageId: { in: events.map((event) => event.id) } },
      });
      await prisma.client.outboxEvent.deleteMany({
        where: { aggregateType: 'Order', aggregateId: orderId },
      });
      await prisma.client.order.deleteMany({ where: { id: orderId } });
    }

    async function consumerCountOf(queue: string): Promise<number | null> {
      const channel = await brokerConnection!.createChannel();
      channel.on('error', () => undefined);
      try {
        const { consumerCount } = await channel.checkQueue(queue);
        await channel.close();
        return consumerCount;
      } catch {
        return null;
      }
    }

    beforeAll(async () => {
      // Before compiling the module: no wait in the simulated services and a
      // fast relay, so the whole lifecycle takes a couple of seconds.
      process.env.ORDER_SIMULATION_ENABLED = 'true';
      process.env.ORDER_SIMULATION_DELAY_FACTOR = '0';
      process.env.OUTBOX_RELAY_ENABLED = 'true';
      process.env.OUTBOX_POLL_INTERVAL_MS = '200';
      process.env.EVENT_CONSUMERS_ENABLED = 'true';
      process.env.LIVE_EVENTS_ENABLED = 'true';

      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const config = moduleFixture.get(ConfigService);
      const exchange =
        config.get<string>('RABBITMQ_EXCHANGE')?.trim() || 'jaja.events';
      const url =
        config.get<string>('RABBITMQ_URL')?.trim() ||
        'amqp://jaja:jaja@localhost:5672';

      app = moduleFixture.createNestApplication();
      await app.init();
      prisma = app.get(PrismaService);
      brokerConnection = await amqp.connect(url);
      brokerChannel = await brokerConnection.createChannel();

      // The subscriptions do not wait for the broker: wait for the simulated
      // services and for the live feed (a probe published straight to the
      // exchange must come back through it).
      for (const step of ORDER_SIMULATION_STEPS) {
        const queue = `jaja.${step.consumerName}`;
        await waitFor(`a consumer on ${queue}`, async () =>
          ((await consumerCountOf(queue)) ?? 0) > 0 ? true : null,
        );
      }
      const probeId = randomUUID();
      let probed = false;
      const probe = app
        .get(LiveEventFeed)
        .events$.subscribe(
          (message) => (probed ||= message.messageId === probeId),
        );
      await waitFor('the live feed', async () => {
        if (probed) return true;
        const body = {
          messageId: probeId,
          type: PROBE_EVENT_TYPE,
          payload: {},
          metadata: {},
          occurredAt: new Date().toISOString(),
        };
        brokerChannel.publish(
          exchange,
          PROBE_EVENT_TYPE,
          Buffer.from(JSON.stringify(body)),
          {
            contentType: 'application/json',
            messageId: probeId,
            type: PROBE_EVENT_TYPE,
          },
        );
        return null;
      });
      probe.unsubscribe();

      // The order of the seed customer, with two available products of the seed.
      const orderPrisma = app.get(OrderPrisma);
      const user = await prisma.client.user.findUniqueOrThrow({
        where: { email: CUSTOMER_EMAIL },
      });
      const customer = await orderPrisma.findOrderCustomerByUserId.execute(
        user.id,
      );
      expect(customer.instance?.isActive).toBe(true);
      const products = await prisma.client.product.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { priceCents: 'asc' },
        take: 2,
      });
      expect(products).toHaveLength(2);

      const placed = Order.place({
        customerId: customer.instance!.customerId,
        items: products.map((product, index) => ({
          productId: product.id,
          name: product.name,
          unit: product.unit,
          thumbUrl: null,
          unitPriceCents: product.priceCents,
          quantity: index + 1,
        })),
        deliveryAddress: customer.instance!.deliveryAddress,
        recipientName: customer.instance!.name,
        deliveryInstructions: 'Pedido do teste order-lifecycle.e2e',
      });
      placed.validator.throwsIfFailed();
      const order = placed.instance;
      orderId = order.id;

      // Subscribed before storing, so the notice of `order.placed` is not missed.
      streamSubscription = app
        .get(OrderLiveUpdates)
        .forOrder(order.id)
        .subscribe((event) => {
          if (event.type === 'order') notices.push(event);
        });

      const domainEvents = app.get(DomainEventPrisma);
      await prisma.runInTransaction(async (tx) => {
        const created = await orderPrisma.create(order, tx);
        created.validator.throwsIfFailed();
        const appended = await domainEvents.append(order.pullEvents(), tx);
        appended.validator.throwsIfFailed();
      });

      // The last notice arrives after the relay publishes `order.delivered`.
      await waitFor(
        'the order to be DELIVERED with every notice',
        async () => {
          const row = await prisma.client.order.findUnique({
            where: { id: order.id },
          });
          return row?.status === 'DELIVERED' &&
            notices.length >= EVENT_TYPES.length
            ? true
            : null;
        },
        LIFECYCLE_TIMEOUT_MS,
      );
    }, SETUP_TIMEOUT_MS);

    afterAll(async () => {
      streamSubscription?.unsubscribe();
      await deleteTestRows();
      await app?.close();
      await brokerConnection?.close();
    });

    it('ends DELIVERED with the four step dates filled in ascending order', async () => {
      const order = await prisma.client.order.findUniqueOrThrow({
        where: { id: orderId! },
      });

      expect(order.status).toBe('DELIVERED');
      const dates = [
        order.placedAt,
        order.paymentApprovedAt,
        order.pickingStartedAt,
        order.outForDeliveryAt,
        order.deliveredAt,
      ];
      for (const date of dates) expect(date).toBeInstanceOf(Date);
      const times = dates.map((date) => date!.getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it('stores the five events in order, published, with the causation and correlation chain', async () => {
      const events = await outboxOf(orderId!);

      expect(events.map((event) => event.type)).toEqual(EVENT_TYPES);
      for (const event of events)
        expect(event.status).toBe(DomainEventStatus.PUBLISHED);

      const [placed, ...changes] = events;
      changes.forEach((event, index) => {
        expect(event.metadata).toMatchObject({
          correlationId: placed.id,
          causationId: events[index].id,
        });
      });
    });

    it('carries the fact of each simulated service in the payload of its event', async () => {
      const [, approved, picking, dispatched, delivered] = await outboxOf(
        orderId!,
      );
      const order = await prisma.client.order.findUniqueOrThrow({
        where: { id: orderId! },
      });
      // The data of each service is derived from the id of the order.
      const short = orderId!.slice(0, 8).toUpperCase();

      expect(approved.payload).toMatchObject({
        previousStatus: 'PLACED',
        status: 'PAYMENT_APPROVED',
        transactionId: `TX-${short}`,
        paymentMethod: 'SIMULATED',
        amountCents: order.totalCents,
      });
      expect(picking.payload).toMatchObject({
        status: 'PICKING',
        pickingListId: `SEP-${short}`,
        itemCount: expect.any(Number),
      });
      expect(dispatched.payload).toMatchObject({
        status: 'OUT_FOR_DELIVERY',
        courierName: SIMULATED_COURIER_NAME,
        trackingCode: `JAJA-${short}`,
        estimatedDeliveryAt: expect.any(String),
      });
      // Nobody informs who took the order, so it is the recipient of the order.
      expect(delivered.payload).toMatchObject({
        status: 'DELIVERED',
        receivedBy: order.recipientName,
      });
    });

    it('marks each message as processed once by its simulated service', async () => {
      const events = await outboxOf(orderId!);

      const processed = await prisma.client.processedMessage.findMany({
        where: { messageId: { in: events.map((event) => event.id) } },
        orderBy: { processedAt: 'asc' },
      });

      expect(
        processed.map(({ consumer, messageId, messageType }) => ({
          consumer,
          messageId,
          messageType,
        })),
      ).toEqual(
        ORDER_SIMULATION_STEPS.map((step, index) => ({
          consumer: step.consumerName,
          messageId: events[index].id,
          messageType: step.eventType,
        })),
      );
    });

    it('sends one live notice per event, without the payload', async () => {
      const events = await outboxOf(orderId!);

      expect(
        notices.map(
          (notice) => (notice.data as { eventType: string }).eventType,
        ),
      ).toEqual(EVENT_TYPES);
      notices.forEach((notice, index) => {
        expect(notice.data).toEqual({
          orderId,
          eventType: events[index].type,
          messageId: events[index].id,
          occurredAt: events[index].occurredAt.toISOString(),
        });
      });
    });
  },
);
