/**
 * Integration test of the event consumers against the real Postgres and RabbitMQ.
 *
 * Runs only with `MESSAGING_E2E=true`; otherwise it is skipped, so
 * `npm run test:e2e` keeps working without a broker. Prerequisites:
 * - the `postgres` and `rabbitmq` services of `docker-compose.yml` running
 *   (`npm run db:start` and `npm run broker:start` in `@jaja/backend`);
 * - the `messaging_outbox` and `messaging_processed_messages` migrations applied;
 * - no `npm run dev` of the backend running: its relay would compete with the
 *   test for the pending rows.
 *
 * Then: `MESSAGING_E2E=true npm run test:e2e --workspace=@jaja/backend`.
 * The test registers the consumers `messaging-test.echo` and
 * `messaging-test.delayed`, and at the end deletes only their rows
 * (`processed_messages` with `consumer LIKE 'messaging-test.%'`, `outbox_events`
 * with `aggregate_type = 'MessagingTest'`) and their queues
 * (`jaja.messaging-test.*`, `.wait` and `.dead` included).
 */
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AbstractDomainEvent,
  BrokerMessage,
  DomainEventMetadata,
  DomainEventStatus,
  Result,
  ResultError,
  TransactionManager,
} from '@mentoria-360/shared';
import amqp from 'amqplib';
import type { Channel, ChannelModel, GetMessage } from 'amqplib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/db/prisma.service.js';
import type { TransactionalEventConsumer } from '../src/messaging/consumer/event-consumer.js';
import { EventConsumerRegistry } from '../src/messaging/consumer/event-consumer.registry.js';
import { EventConsumerRunner } from '../src/messaging/consumer/event-consumer.runner.js';
import { DomainEventPrisma } from '../src/messaging/outbox/domain-event.prisma.js';
import { OutboxRelay } from '../src/messaging/outbox/outbox-relay.js';

const TEST_AGGREGATE_TYPE = 'MessagingTest';
const TEST_EVENT_TYPE = 'messaging.test-event';
const DELAYED_EVENT_TYPE = 'messaging.test-delayed';
const ECHOED_EVENT_TYPE = 'messaging.test-echoed';
const ECHO_CONSUMER = 'messaging-test.echo';
const DELAYED_CONSUMER = 'messaging-test.delayed';
const ECHO_QUEUE = `jaja.${ECHO_CONSUMER}`;
const DELAYED_QUEUE = `jaja.${DELAYED_CONSUMER}`;
const TEST_QUEUES = [ECHO_QUEUE, DELAYED_QUEUE].flatMap((queue) => [
  queue,
  `${queue}.wait`,
  `${queue}.dead`,
]);
const DELAY_MS = 1_500;
const TEST_TIMEOUT_MS = 20_000;

type EchoMode = 'ok' | 'fail-once' | 'always-fail';

interface MessagingTestProps {
  type: string;
  payload: Record<string, unknown>;
  metadata?: DomainEventMetadata;
  aggregateId?: string;
}

class MessagingTestEvent extends AbstractDomainEvent<Record<string, unknown>> {
  static create({ type, payload, metadata, aggregateId }: MessagingTestProps): MessagingTestEvent {
    return MessagingTestEvent.createFromProps<
      Record<string, unknown>,
      DomainEventMetadata,
      MessagingTestEvent
    >(
      {
        id: randomUUID(),
        type,
        aggregateType: TEST_AGGREGATE_TYPE,
        aggregateId: aggregateId ?? randomUUID(),
        payload,
        metadata: metadata ?? {},
      },
      (props) => new MessagingTestEvent(props),
    );
  }
}

async function waitFor<T>(
  description: string,
  probe: () => Promise<T | null | undefined>,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${description}`);
}

describe.runIf(process.env.MESSAGING_E2E === 'true')('Messaging consumers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let domainEvents: DomainEventPrisma;
  let relay: OutboxRelay;
  let exchange: string;
  let brokerConnection: ChannelModel;
  let brokerChannel: Channel;

  // Results of `EventConsumerRunner.handle`, by messageId and in order, and
  // when each call started.
  const outcomes = new Map<string, string[]>();
  const startedAt = new Map<string, number[]>();
  // messageIds that already failed once in the `fail-once` mode.
  const failedOnce = new Set<string>();
  // When `messaging-test.delayed` was called, by messageId.
  const delayedCalls = new Map<string, number>();

  // Behaves like a use case: stores an event with the received transaction
  // manager and returns a `Result`.
  const echoConsumer: TransactionalEventConsumer = {
    name: ECHO_CONSUMER,
    eventType: TEST_EVENT_TYPE,
    async handle(message: BrokerMessage, transactionManager: TransactionManager) {
      try {
        await transactionManager.runInTransaction(async (tx) => {
          const echoed = MessagingTestEvent.create({
            type: ECHOED_EVENT_TYPE,
            aggregateId: String(message.payload.aggregateId),
            payload: { originalId: message.messageId },
          });
          const appended = await domainEvents.append([echoed], tx);
          appended.validator.throwsIfFailed();
        });
      } catch (error) {
        if (error instanceof ResultError) return Result.fail(error.errors);
        throw error;
      }

      const mode = message.payload.mode as EchoMode;
      if (mode === 'always-fail') return Result.fail('MESSAGING_TEST_ALWAYS_FAILS');
      if (mode === 'fail-once' && !failedOnce.has(message.messageId)) {
        failedOnce.add(message.messageId);
        return Result.fail('MESSAGING_TEST_FAILS_ONCE');
      }
      return Result.ok();
    },
  };

  const delayedConsumer: TransactionalEventConsumer = {
    name: DELAYED_CONSUMER,
    eventType: DELAYED_EVENT_TYPE,
    delayMs: DELAY_MS,
    async handle(message: BrokerMessage) {
      delayedCalls.set(message.messageId, Date.now());
      return Result.ok();
    },
  };

  const deleteTestRows = async () => {
    await prisma.client.processedMessage.deleteMany({
      where: { consumer: { startsWith: 'messaging-test.' } },
    });
    await prisma.client.outboxEvent.deleteMany({ where: { aggregateType: TEST_AGGREGATE_TYPE } });
  };

  async function deleteTestQueues(): Promise<void> {
    // A failed `deleteQueue` closes the channel, so each one uses its own.
    for (const queue of TEST_QUEUES) {
      const channel = await brokerConnection.createChannel();
      channel.on('error', () => undefined);
      try {
        await channel.deleteQueue(queue);
        await channel.close();
      } catch {
        // Missing queue.
      }
    }
  }

  // Publishes through the real path: outbox in a transaction, then the relay.
  async function publishThroughOutbox(event: MessagingTestEvent): Promise<void> {
    await prisma.runInTransaction(async (tx) => {
      const appended = await domainEvents.append([event], tx);
      appended.validator.throwsIfFailed();
    });
    await relay.runOnce();
  }

  // Publishes a body in the format of the publisher straight to the exchange.
  function publishDirectly(message: {
    messageId: string;
    type: string;
    payload: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }): void {
    const body = { ...message, occurredAt: new Date().toISOString() };
    brokerChannel.publish(exchange, message.type, Buffer.from(JSON.stringify(body)), {
      persistent: true,
      contentType: 'application/json',
      messageId: message.messageId,
      type: message.type,
    });
  }

  const processedCount = (messageId: string, consumer = ECHO_CONSUMER) =>
    prisma.client.processedMessage.count({ where: { consumer, messageId } });

  const echoesOf = (aggregateId: string) =>
    prisma.client.outboxEvent.findMany({
      where: { aggregateType: TEST_AGGREGATE_TYPE, aggregateId, type: ECHOED_EVENT_TYPE },
    });

  // `handle` ends after the commit, so its outcome is the signal that the
  // transaction of the consumer is over.
  async function waitForOutcomes(messageId: string, count: number): Promise<string[]> {
    return waitFor(`${count} outcome(s) of ${messageId}`, async () => {
      const list = outcomes.get(messageId) ?? [];
      return list.length >= count ? list : null;
    });
  }

  async function waitForDead(queue: string, messageId: string): Promise<GetMessage> {
    return waitFor(`message ${messageId} in ${queue}`, async () => {
      const message = await brokerChannel.get(queue, { noAck: true });
      return message && message.properties.messageId === messageId ? message : null;
    });
  }

  beforeAll(async () => {
    // Before compiling the module: the automatic relay would compete with the
    // test for the rows (the test runs `runOnce()` by hand), and two attempts
    // make the discard take about 1 s.
    process.env.OUTBOX_RELAY_ENABLED = 'false';
    process.env.EVENT_CONSUMERS_ENABLED = 'true';
    process.env.EVENT_CONSUMER_MAX_ATTEMPTS = '2';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const config = moduleFixture.get(ConfigService);
    exchange = config.get<string>('RABBITMQ_EXCHANGE')?.trim() || 'jaja.events';
    const url = config.get<string>('RABBITMQ_URL')?.trim() || 'amqp://jaja:jaja@localhost:5672';
    brokerConnection = await amqp.connect(url);
    brokerChannel = await brokerConnection.createChannel();
    // Leftovers of an interrupted run.
    await deleteTestQueues();

    domainEvents = moduleFixture.get(DomainEventPrisma);
    const registry = moduleFixture.get(EventConsumerRegistry);
    registry.register(echoConsumer);
    registry.register(delayedConsumer);

    const runner = moduleFixture.get(EventConsumerRunner);
    const handle = runner.handle.bind(runner);
    vi.spyOn(runner, 'handle').mockImplementation(async (consumer, message) => {
      const { messageId } = message;
      startedAt.set(messageId, [...(startedAt.get(messageId) ?? []), Date.now()]);
      const result = await handle(consumer, message);
      const outcome = result.isOk ? result.instance : `failed:${result.errors.join(',')}`;
      outcomes.set(messageId, [...(outcomes.get(messageId) ?? []), outcome]);
      return result;
    });

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    relay = app.get(OutboxRelay);
    await deleteTestRows();

    // The subscriptions do not wait for the broker: wait for the consumers.
    for (const queue of [ECHO_QUEUE, DELAYED_QUEUE]) {
      await waitFor(`a consumer on ${queue}`, async () => {
        const channel = await brokerConnection.createChannel();
        channel.on('error', () => undefined);
        try {
          const { consumerCount } = await channel.checkQueue(queue);
          await channel.close();
          return consumerCount > 0 ? true : null;
        } catch {
          return null;
        }
      });
    }
  });

  beforeEach(() => {
    outcomes.clear();
    startedAt.clear();
  });

  afterAll(async () => {
    if (prisma) await deleteTestRows();
    // Closing the app first: a deleted queue would be declared again by the
    // consumer that is still subscribed.
    await app?.close();
    if (brokerConnection) {
      await deleteTestQueues();
      await brokerConnection.close();
    }
    vi.restoreAllMocks();
  });

  it(
    'processes a message once, storing the mark and the echo with causation and correlation',
    async () => {
      const event = MessagingTestEvent.create({ type: TEST_EVENT_TYPE, payload: { mode: 'ok' } });

      await publishThroughOutbox(event);

      expect(await waitForOutcomes(event.id, 1)).toEqual(['processed']);
      expect(await processedCount(event.id)).toBe(1);
      const echoes = await echoesOf(event.aggregateId);
      expect(echoes).toHaveLength(1);
      const [echo] = echoes;
      expect(echo.status).toBe(DomainEventStatus.PENDING);
      expect(echo.payload).toEqual({ originalId: event.id });
      expect(echo.metadata).toEqual({ causationId: event.id, correlationId: event.id });

      const processed = await prisma.client.processedMessage.findUniqueOrThrow({
        where: { consumer_messageId: { consumer: ECHO_CONSUMER, messageId: event.id } },
      });
      expect(processed.messageType).toBe(TEST_EVENT_TYPE);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'keeps the correlationId of the original message in the echo',
    async () => {
      const correlationId = randomUUID();
      const event = MessagingTestEvent.create({
        type: TEST_EVENT_TYPE,
        payload: { mode: 'ok' },
        metadata: { correlationId },
      });

      await publishThroughOutbox(event);

      expect(await waitForOutcomes(event.id, 1)).toEqual(['processed']);
      const [echo] = await echoesOf(event.aggregateId);
      expect(echo.metadata).toEqual({ causationId: event.id, correlationId });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'processes a repeated message (same messageId) only once',
    async () => {
      const messageId = randomUUID();
      const aggregateId = randomUUID();
      const message = {
        messageId,
        type: TEST_EVENT_TYPE,
        payload: { mode: 'ok', aggregateId, aggregateType: TEST_AGGREGATE_TYPE },
        metadata: {},
      };

      publishDirectly(message);
      publishDirectly(message);

      const handled = await waitForOutcomes(messageId, 2);
      expect([...handled].sort()).toEqual(['duplicate', 'processed']);
      expect(await processedCount(messageId)).toBe(1);
      expect(await echoesOf(aggregateId)).toHaveLength(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'retries a failed message through the .wait queue and keeps a single echo',
    async () => {
      const event = MessagingTestEvent.create({
        type: TEST_EVENT_TYPE,
        payload: { mode: 'fail-once' },
      });
      await publishThroughOutbox(event);

      expect(await waitForOutcomes(event.id, 2)).toEqual([
        'failed:MESSAGING_TEST_FAILS_ONCE',
        'processed',
      ]);
      expect(await processedCount(event.id)).toBe(1);
      // The retry waited 1 s in `jaja.messaging-test.echo.wait`.
      const [first, second] = startedAt.get(event.id) ?? [];
      expect(second - first).toBeGreaterThanOrEqual(1_000);
      const echoes = await echoesOf(event.aggregateId);
      expect(echoes).toHaveLength(1);
      expect(echoes[0].metadata).toEqual({ causationId: event.id, correlationId: event.id });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'discards to .dead after the last attempt, without mark nor echo',
    async () => {
      const event = MessagingTestEvent.create({
        type: TEST_EVENT_TYPE,
        payload: { mode: 'always-fail' },
      });

      await publishThroughOutbox(event);

      const dead = await waitForDead(`${ECHO_QUEUE}.dead`, event.id);
      const headers = dead.properties.headers ?? {};
      expect(headers['x-jaja-dead-reason']).toBe('MAX_ATTEMPTS_EXCEEDED');
      expect(headers['x-jaja-attempt']).toBe(2);
      expect(headers['x-jaja-last-error']).toBe('MESSAGING_TEST_ALWAYS_FAILS');
      expect(dead.properties.type).toBe(TEST_EVENT_TYPE);
      expect(JSON.parse(dead.content.toString()).messageId).toBe(event.id);
      expect(outcomes.get(event.id)).toEqual([
        'failed:MESSAGING_TEST_ALWAYS_FAILS',
        'failed:MESSAGING_TEST_ALWAYS_FAILS',
      ]);
      expect(await processedCount(event.id)).toBe(0);
      expect(await echoesOf(event.aggregateId)).toHaveLength(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'discards a body that is not JSON to .dead with MESSAGE_INVALID',
    async () => {
      const messageId = randomUUID();

      brokerChannel.sendToQueue(ECHO_QUEUE, Buffer.from('not json'), {
        persistent: true,
        messageId,
        type: TEST_EVENT_TYPE,
      });

      const dead = await waitForDead(`${ECHO_QUEUE}.dead`, messageId);
      expect(dead.properties.headers?.['x-jaja-dead-reason']).toBe('MESSAGE_INVALID');
      expect(dead.content.toString()).toBe('not json');
      expect(outcomes.has(messageId)).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'calls a consumer with an initial wait only after the wait',
    async () => {
      const event = MessagingTestEvent.create({ type: DELAYED_EVENT_TYPE, payload: {} });
      // Taken before the commit: the message cannot be published earlier.
      const before = Date.now();

      await publishThroughOutbox(event);

      await waitForOutcomes(event.id, 1);
      const calledAt = delayedCalls.get(event.id)!;
      expect(calledAt - before).toBeGreaterThanOrEqual(DELAY_MS);
      expect(await processedCount(event.id, DELAYED_CONSUMER)).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );
});
