import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BrokerMessage,
  ConsumeMessageIn,
  MessageConsumer,
  Result,
  TransactionManager,
} from '@mentoria-360/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveTransactionManager } from '../../db/active-transaction.manager.js';
import { PrismaService, PrismaTransactionContext } from '../../db/prisma.service.js';
import type { RabbitMqSubscription } from '../rabbitmq/rabbitmq-message.consumer.js';
import type { TransactionalEventConsumer } from './event-consumer.js';
import { EventConsumerRegistry } from './event-consumer.registry.js';
import { EventConsumerRunner } from './event-consumer.runner.js';
import { ConsumerTransactionContext } from './message-causation.js';
import { ProcessedMessagePrisma } from './processed-message.prisma.js';

const LOG_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;
const PERSONAL_EMAIL = 'cliente@exemplo.com';
const PERSONAL_IP = '10.0.0.1';

const MESSAGE: BrokerMessage = {
  messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
  type: 'order.placed',
  payload: { email: PERSONAL_EMAIL, aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d' },
  metadata: { ip: PERSONAL_IP, correlationId: 'chain-1' },
  occurredAt: new Date('2026-09-14T12:00:00.000Z'),
};

// Runs the operation like `$transaction` does: a thrown error is recorded as a
// rollback and rethrown.
class FakePrismaService {
  readonly client = { name: 'transaction client' };
  readonly contexts: PrismaTransactionContext[] = [];
  commits = 0;
  rollbacks = 0;

  async runInTransaction<T>(
    operation: (context: PrismaTransactionContext) => Promise<T>,
  ): Promise<T> {
    const context = { client: this.client } as unknown as PrismaTransactionContext;
    this.contexts.push(context);
    try {
      const value = await operation(context);
      this.commits += 1;
      return value;
    } catch (error) {
      this.rollbacks += 1;
      throw error;
    }
  }
}

function consumer(overrides: Partial<TransactionalEventConsumer> = {}) {
  const handle = vi.fn<TransactionalEventConsumer['handle']>(async () => Result.ok());
  return {
    consumer: { name: 'orders.approve-payment', eventType: 'order.placed', handle, ...overrides },
    handle,
  };
}

function createRunner(env: Record<string, string | undefined> = {}) {
  const prisma = new FakePrismaService();
  const markProcessed = vi.fn<ProcessedMessagePrisma['markProcessed']>(async () => true);
  const subscribe = vi.fn<MessageConsumer['subscribe']>(async () => Result.ok());
  const registry = new EventConsumerRegistry();
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const runner = new EventConsumerRunner(
    registry,
    prisma as unknown as PrismaService,
    { markProcessed } as unknown as ProcessedMessagePrisma,
    { subscribe },
    config,
  );
  return { runner, prisma, markProcessed, subscribe, registry };
}

describe('EventConsumerRunner', () => {
  let logged: { level: string; text: string }[];

  beforeEach(() => {
    logged = [];
    for (const level of LOG_LEVELS) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => {
        logged.push({ level, text: args.map((arg) => String(arg)).join(' ') });
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes nothing with EVENT_CONSUMERS_ENABLED=false', async () => {
    const { runner, registry, subscribe } = createRunner({ EVENT_CONSUMERS_ENABLED: 'false' });
    registry.register(consumer().consumer);

    await runner.onApplicationBootstrap();

    expect(subscribe).not.toHaveBeenCalled();
    expect(logged.some((line) => line.text.includes('EVENT_CONSUMERS_ENABLED=false'))).toBe(true);
  });

  it('subscribes each consumer to jaja.<name> with its event type and delay', async () => {
    const { runner, registry, subscribe } = createRunner({ EVENT_CONSUMERS_ENABLED: 'true' });
    registry.register(consumer().consumer);
    registry.register(
      consumer({ name: 'orders.ship-order', eventType: 'order.picked', delayMs: 1_500 }).consumer,
    );

    await runner.onApplicationBootstrap();

    expect(subscribe).toHaveBeenCalledTimes(2);
    const [first, second] = subscribe.mock.calls.map(([input]) => input as RabbitMqSubscription);
    expect(first).toMatchObject({
      queue: 'jaja.orders.approve-payment',
      routingKeys: ['order.placed'],
      delayMs: 0,
    });
    expect(second).toMatchObject({
      queue: 'jaja.orders.ship-order',
      routingKeys: ['order.picked'],
      delayMs: 1_500,
    });
    expect(logged).toContainEqual({ level: 'log', text: '2 consumidor(es) assinado(s)' });
  });

  it('logs zero consumers when none is registered', async () => {
    const { runner, subscribe } = createRunner();

    await runner.onApplicationBootstrap();

    expect(subscribe).not.toHaveBeenCalled();
    expect(logged).toContainEqual({ level: 'log', text: '0 consumidor(es) assinado(s)' });
  });

  it('throws when a subscription fails', async () => {
    const { runner, registry, subscribe } = createRunner();
    registry.register(consumer().consumer);
    subscribe.mockResolvedValueOnce(Result.fail('MESSAGE_SUBSCRIPTION_INVALID'));

    await expect(runner.onApplicationBootstrap()).rejects.toThrow('MESSAGE_SUBSCRIPTION_INVALID');
  });

  it('onMessage of the subscription runs handle and returns an empty Result', async () => {
    const { runner, registry, subscribe } = createRunner();
    const { consumer: approve, handle } = consumer();
    registry.register(approve);
    await runner.onApplicationBootstrap();

    const { onMessage } = subscribe.mock.calls[0][0] as ConsumeMessageIn;
    const result = await onMessage(MESSAGE);

    expect(result.isOk).toBe(true);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('marks, calls the handler over the same transaction with the causation and commits', async () => {
    const { runner, prisma, markProcessed } = createRunner();
    const { consumer: approve, handle } = consumer();
    let received: TransactionManager | undefined;
    const handlerContexts: unknown[] = [];
    handle.mockImplementation(async (_message, transactionManager) => {
      received = transactionManager;
      await transactionManager.runInTransaction(async (tx) => {
        handlerContexts.push(tx);
      });
      return Result.ok();
    });

    const result = await runner.handle(approve, MESSAGE);

    expect(result.isOk).toBe(true);
    expect(result.instance).toBe('processed');
    expect(prisma.contexts).toHaveLength(1);
    expect(prisma.commits).toBe(1);

    const [consumerName, message, markContext] = markProcessed.mock.calls[0];
    expect(consumerName).toBe('orders.approve-payment');
    expect(message).toBe(MESSAGE);
    const context = markContext as ConsumerTransactionContext;
    expect(context.client).toBe(prisma.client);
    expect(context.causation).toEqual({ causationId: MESSAGE.messageId, correlationId: 'chain-1' });

    expect(received).toBeInstanceOf(ActiveTransactionManager);
    expect(handle.mock.calls[0][0]).toBe(MESSAGE);
    expect(handlerContexts).toEqual([context]);
    expect(handlerContexts[0]).toBe(context);
    expect(logged).toContainEqual({
      level: 'log',
      text: `Mensagem ${MESSAGE.messageId} (order.placed) processada por orders.approve-payment`,
    });
  });

  it('ends a repeated message as duplicate without calling the handler', async () => {
    const { runner, markProcessed } = createRunner();
    const { consumer: approve, handle } = consumer();
    markProcessed.mockResolvedValueOnce(false);

    const result = await runner.handle(approve, MESSAGE);

    expect(result.isOk).toBe(true);
    expect(result.instance).toBe('duplicate');
    expect(handle).not.toHaveBeenCalled();
    const debug = logged.find((line) => line.level === 'debug');
    expect(debug?.text).toContain(MESSAGE.messageId);
    expect(debug?.text).toContain('já processada');
  });

  it('rolls the transaction back and returns the codes of a failed Result', async () => {
    const { runner, prisma } = createRunner();
    const { consumer: approve, handle } = consumer();
    handle.mockResolvedValueOnce(Result.fail(['ORDER_NOT_FOUND', 'ORDER_INVALID']));

    const result = await runner.handle(approve, MESSAGE);

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual(['ORDER_NOT_FOUND', 'ORDER_INVALID']);
    expect(prisma.rollbacks).toBe(1);
    expect(prisma.commits).toBe(0);
    const warning = logged.find((line) => line.level === 'warn');
    expect(warning?.text).toContain(MESSAGE.messageId);
    expect(warning?.text).toContain('order.placed');
    expect(warning?.text).toContain('orders.approve-payment');
    expect(warning?.text).toContain('ORDER_NOT_FOUND, ORDER_INVALID');
  });

  it('turns an exception of the handler into Result.fail without rejecting', async () => {
    const { runner, prisma } = createRunner();
    const { consumer: approve, handle } = consumer();
    handle.mockRejectedValueOnce(new Error('Transaction already closed'));

    const result = await runner.handle(approve, MESSAGE);

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual(['Transaction already closed']);
    expect(prisma.rollbacks).toBe(1);
  });

  it('turns an exception of the mark into Result.fail without calling the handler', async () => {
    const { runner, markProcessed } = createRunner();
    const { consumer: approve, handle } = consumer();
    markProcessed.mockRejectedValueOnce(new Error('connection refused'));

    const result = await runner.handle(approve, MESSAGE);

    expect(result.errors).toEqual(['connection refused']);
    expect(handle).not.toHaveBeenCalled();
  });

  it('never logs the payload nor the metadata', async () => {
    const { runner, markProcessed } = createRunner();
    const { consumer: approve, handle } = consumer();
    handle.mockResolvedValueOnce(Result.ok());
    handle.mockResolvedValueOnce(Result.fail('ORDER_INVALID'));
    handle.mockRejectedValueOnce(new Error('boom'));

    await runner.handle(approve, MESSAGE);
    await runner.handle(approve, MESSAGE);
    await runner.handle(approve, MESSAGE);
    markProcessed.mockResolvedValueOnce(false);
    await runner.handle(approve, MESSAGE);

    expect(logged.length).toBeGreaterThanOrEqual(4);
    const text = logged.map((line) => line.text).join('\n');
    expect(text).not.toContain(PERSONAL_EMAIL);
    expect(text).not.toContain(PERSONAL_IP);
    expect(text).not.toContain('chain-1');
  });
});
