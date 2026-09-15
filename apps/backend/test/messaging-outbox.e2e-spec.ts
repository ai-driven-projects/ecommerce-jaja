/**
 * Integration test of the outbox against the real Postgres and RabbitMQ.
 *
 * Runs only with `MESSAGING_E2E=true`; otherwise it is skipped, so
 * `npm run test:e2e` keeps working without a broker. Prerequisites:
 * - the `postgres` and `rabbitmq` services of `docker-compose.yml` running
 *   (`npm run db:start` and `npm run broker:start` in `@jaja/backend`);
 * - the `messaging_outbox` migration applied;
 * - no `npm run dev` of the backend running: its relay would compete with the
 *   test for the pending rows.
 *
 * Then: `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend`.
 * The test only reads and deletes rows with `aggregate_type = 'MessagingTest'`.
 */
import { randomUUID } from 'node:crypto';
import { AddressInfo, createServer } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AbstractDomainEvent,
  DomainEventMetadata,
  DomainEventStatus,
} from '@mentoria-360/shared';
import amqp from 'amqplib';
import type { Channel, ChannelModel, GetMessage } from 'amqplib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/db/prisma.service.js';
import { MessagingErrors } from '../src/messaging/messaging-errors.js';
import { DomainEventPrisma } from '../src/messaging/outbox/domain-event.prisma.js';
import { OutboxRelay } from '../src/messaging/outbox/outbox-relay.js';
import { OutboxPrisma } from '../src/messaging/outbox/outbox.prisma.js';
import { RabbitMqMessagePublisher } from '../src/messaging/rabbitmq/rabbitmq-message.publisher.js';

const TEST_EVENT_TYPE = 'messaging.test-event';
const TEST_AGGREGATE_TYPE = 'MessagingTest';

type MessagingTestPayload = {
  label: string;
  happenedAt?: Date;
};

class MessagingTestEvent extends AbstractDomainEvent<MessagingTestPayload> {
  static create(payload: MessagingTestPayload, occurredAt?: Date): MessagingTestEvent {
    return MessagingTestEvent.createFromProps<
      MessagingTestPayload,
      DomainEventMetadata,
      MessagingTestEvent
    >(
      {
        id: randomUUID(),
        type: TEST_EVENT_TYPE,
        aggregateType: TEST_AGGREGATE_TYPE,
        aggregateId: randomUUID(),
        payload,
        metadata: { source: 'messaging-outbox.e2e' },
        occurredAt,
      },
      (props) => new MessagingTestEvent(props),
    );
  }
}

// A port nobody listens on: taken from the OS and released right away.
function closedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

describe.runIf(process.env.MESSAGING_E2E === 'true')('Messaging outbox (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let domainEvents: DomainEventPrisma;
  let outbox: OutboxPrisma;
  let relay: OutboxRelay;
  let config: ConfigService;
  let exchange: string;
  let brokerConnection: ChannelModel;
  let brokerChannel: Channel;
  let testQueue: string;

  const deleteTestRows = () =>
    prisma.client.outboxEvent.deleteMany({ where: { aggregateType: TEST_AGGREGATE_TYPE } });

  async function appendCommitted(events: MessagingTestEvent[]): Promise<void> {
    await prisma.runInTransaction(async (tx) => {
      const appended = await domainEvents.append(events, tx);
      appended.validator.throwsIfFailed();
    });
  }

  async function waitForMessage(messageId: string, timeoutMs = 5_000): Promise<GetMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const message = await brokerChannel.get(testQueue, { noAck: true });
      if (message && message.properties.messageId === messageId) return message;
      if (!message) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Message ${messageId} did not reach the test queue in ${timeoutMs} ms`);
  }

  beforeAll(async () => {
    // Before compiling the module: the automatic cycles would compete with the
    // test for the rows. The test runs `runOnce()` by hand.
    process.env.OUTBOX_RELAY_ENABLED = 'false';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    domainEvents = app.get(DomainEventPrisma);
    outbox = app.get(OutboxPrisma);
    relay = app.get(OutboxRelay);
    config = app.get(ConfigService);
    exchange = config.get<string>('RABBITMQ_EXCHANGE')?.trim() || 'jaja.events';

    // Exclusive and temporary queue of the test, bound by the event type; it
    // disappears when the connection of the test closes.
    const url = config.get<string>('RABBITMQ_URL')?.trim() || 'amqp://jaja:jaja@localhost:5672';
    brokerConnection = await amqp.connect(url);
    brokerChannel = await brokerConnection.createChannel();
    await brokerChannel.assertExchange(exchange, 'topic', { durable: true });
    const { queue } = await brokerChannel.assertQueue('', { exclusive: true, autoDelete: true });
    testQueue = queue;
    await brokerChannel.bindQueue(testQueue, exchange, TEST_EVENT_TYPE);
  });

  beforeEach(async () => {
    await deleteTestRows();
    await brokerChannel.purgeQueue(testQueue);
  });

  afterAll(async () => {
    if (prisma) await deleteTestRows();
    await brokerConnection?.close();
    await app?.close();
  });

  it('stores the events as PENDING when the transaction commits', async () => {
    const first = MessagingTestEvent.create({
      label: 'first',
      happenedAt: new Date('2026-09-14T09:00:00.000Z'),
    });
    const second = MessagingTestEvent.create({ label: 'second' });

    await appendCommitted([first, second]);

    const rows = await prisma.client.outboxEvent.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe(DomainEventStatus.PENDING);
      expect(row.attempts).toBe(0);
      expect(row.publishedAt).toBeNull();
      expect(row.lastError).toBeNull();
      // Available right away (with a margin for the clock of the container).
      expect(row.availableAt.getTime()).toBeLessThanOrEqual(Date.now() + 1_000);
    }

    const firstRow = rows.find((row) => row.id === first.id)!;
    expect(firstRow).toMatchObject({
      type: TEST_EVENT_TYPE,
      aggregateType: TEST_AGGREGATE_TYPE,
      aggregateId: first.aggregateId,
      // The date inside the payload is stored as ISO 8601 text.
      payload: { label: 'first', happenedAt: '2026-09-14T09:00:00.000Z' },
      metadata: { source: 'messaging-outbox.e2e' },
      occurredAt: first.occurredAt,
    });
  });

  it('stores nothing when the transaction rolls back after the append', async () => {
    const event = MessagingTestEvent.create({ label: 'rolled back' });

    await expect(
      prisma.runInTransaction(async (tx) => {
        const appended = await domainEvents.append([event], tx);
        expect(appended.isOk).toBe(true);
        throw new Error('aggregate write failed');
      }),
    ).rejects.toThrow('aggregate write failed');

    expect(await prisma.client.outboxEvent.count({ where: { id: event.id } })).toBe(0);
  });

  it('refuses to append without a transaction', async () => {
    const event = MessagingTestEvent.create({ label: 'no transaction' });

    const result = await domainEvents.append([event]);

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual([MessagingErrors.MESSAGING_TRANSACTION_REQUIRED]);
    expect(await prisma.client.outboxEvent.count({ where: { id: event.id } })).toBe(0);
    expect((await domainEvents.append([])).isOk).toBe(true);
  });

  it('runOnce publishes the event to the exchange and marks it PUBLISHED', async () => {
    const event = MessagingTestEvent.create({
      label: 'publish me',
      happenedAt: new Date('2026-09-14T10:00:00.000Z'),
    });
    await appendCommitted([event]);

    const result = await relay.runOnce();
    // Other pending events of the development database may join the batch,
    // so the assertions rely on the id of the test event.
    expect(result.published).toBeGreaterThanOrEqual(1);

    const message = await waitForMessage(event.id);
    expect(message.fields.routingKey).toBe(TEST_EVENT_TYPE);
    expect(message.properties).toMatchObject({
      messageId: event.id,
      type: TEST_EVENT_TYPE,
      contentType: 'application/json',
      deliveryMode: 2,
      appId: 'jaja-backend',
    });
    expect(JSON.parse(message.content.toString())).toEqual({
      messageId: event.id,
      type: TEST_EVENT_TYPE,
      payload: {
        label: 'publish me',
        happenedAt: '2026-09-14T10:00:00.000Z',
        aggregateId: event.aggregateId,
        aggregateType: TEST_AGGREGATE_TYPE,
      },
      metadata: { source: 'messaging-outbox.e2e' },
      occurredAt: event.occurredAt.toISOString(),
    });

    const row = await prisma.client.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(row.status).toBe(DomainEventStatus.PUBLISHED);
    expect(row.publishedAt).toBeInstanceOf(Date);
  });

  it('keeps the event PENDING with a retry when the broker is unreachable', async () => {
    // The oldest pending event, so it is the first of the batch.
    const event = MessagingTestEvent.create(
      { label: 'no broker' },
      new Date('2000-01-01T00:00:00.000Z'),
    );
    await appendCommitted([event]);

    const port = await closedPort();
    const unreachable = new RabbitMqMessagePublisher({
      url: `amqp://jaja:jaja@localhost:${port}`,
      exchange,
    });
    const failingRelay = new OutboxRelay(outbox, unreachable, config);

    try {
      const before = Date.now();
      const result = await failingRelay.runOnce();
      expect(result.failed).toBe(1);

      const row = await prisma.client.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
      expect(row.status).toBe(DomainEventStatus.PENDING);
      expect(row.attempts).toBe(1);
      expect(row.lastError).toBe(MessagingErrors.MESSAGE_BROKER_UNAVAILABLE);
      expect(row.publishedAt).toBeNull();
      // 1st failure: available again 1 s later.
      expect(row.availableAt.getTime()).toBeGreaterThanOrEqual(before + 1_000);
      expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    } finally {
      await unreachable.onModuleDestroy();
    }
  });
});
