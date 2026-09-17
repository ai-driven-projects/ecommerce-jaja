import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { BrokerMessage } from '@mentoria-360/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagingErrors } from '../messaging-errors.js';
import {
  RabbitMqMessagePublisher,
  RabbitMqPublisherConfig,
} from './rabbitmq-message.publisher.js';

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock('amqplib', () => ({
  default: { connect: connectMock },
  connect: connectMock,
}));

const LOG_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;
const PASSWORD = 's3nh4';
const URL_WITH_SECRET = `amqp://usuario:${PASSWORD}@localhost:5999`;

const MESSAGE: BrokerMessage = {
  messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
  type: 'messaging.test-event',
  payload: { value: 42, aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d' },
  metadata: { correlationId: 'abc-123' },
  occurredAt: new Date('2026-09-14T12:30:45.678Z'),
};

type ConfirmCallback = (error: unknown, ok?: object) => void;

class FakeChannel extends EventEmitter {
  // 'ack' and 'nack' confirm on the next tick; 'manual' waits for `confirmNext`.
  confirmMode: 'ack' | 'nack' | 'manual' = 'ack';
  private readonly pending: ConfirmCallback[] = [];

  assertExchange = vi.fn(async (exchange: string) => ({ exchange }));
  assertQueue = vi.fn(async (queue: string) => ({ queue, messageCount: 0, consumerCount: 0 }));
  bindQueue = vi.fn(async () => ({}));
  close = vi.fn(async () => undefined);
  publish = vi.fn(
    (
      _exchange: string,
      _routingKey: string,
      _content: Buffer,
      _options: object,
      callback: ConfirmCallback,
    ) => {
      if (this.confirmMode === 'manual') {
        this.pending.push(callback);
      } else {
        const error = this.confirmMode === 'nack' ? new Error('message nacked') : null;
        setImmediate(() => callback(error, {}));
      }
      return true;
    },
  );

  confirmNext(): void {
    this.pending.shift()?.(null, {});
  }
}

class FakeConnection extends EventEmitter {
  readonly channel = new FakeChannel();
  createConfirmChannel = vi.fn(async () => this.channel);
  close = vi.fn(async () => undefined);
}

function createPublisher(overrides: Partial<RabbitMqPublisherConfig> = {}) {
  return new RabbitMqMessagePublisher({
    url: 'amqp://jaja:jaja@localhost:5672',
    exchange: 'jaja.events',
    ...overrides,
  });
}

function connectionRefused(): Error {
  return new Error(`connect ECONNREFUSED 127.0.0.1:5999 while opening ${URL_WITH_SECRET}`);
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('RabbitMqMessagePublisher', () => {
  let logged: string[];
  let connections: FakeConnection[];

  beforeEach(() => {
    logged = [];
    for (const level of LOG_LEVELS) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => {
        logged.push(args.map((arg) => String(arg)).join(' '));
      });
    }

    connections = [];
    connectMock.mockReset();
    connectMock.mockImplementation(async () => {
      const connection = new FakeConnection();
      connections.push(connection);
      return connection;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects with a 5 s timeout and declares the durable topic exchange', async () => {
    const publisher = createPublisher();

    const result = await publisher.publish({ message: MESSAGE });

    expect(result.isOk).toBe(true);
    expect(connectMock).toHaveBeenCalledWith('amqp://jaja:jaja@localhost:5672', { timeout: 5_000 });
    expect(connections[0].createConfirmChannel).toHaveBeenCalledTimes(1);
    expect(connections[0].channel.assertExchange).toHaveBeenCalledWith('jaja.events', 'topic', {
      durable: true,
    });
  });

  it('declares the durable inspection queue and binds it with #', async () => {
    const publisher = createPublisher({ inspectionQueue: 'jaja.events.all' });

    await publisher.publish({ message: MESSAGE });

    const { channel } = connections[0];
    expect(channel.assertQueue).toHaveBeenCalledWith('jaja.events.all', { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledWith('jaja.events.all', 'jaja.events', '#');
  });

  it('declares no queue without an inspection queue', async () => {
    const publisher = createPublisher({ inspectionQueue: '' });

    await publisher.publish({ message: MESSAGE });

    expect(connections[0].channel.assertQueue).not.toHaveBeenCalled();
    expect(connections[0].channel.bindQueue).not.toHaveBeenCalled();
  });

  it('publishes a persistent JSON message and resolves only after the confirmation', async () => {
    const publisher = createPublisher();
    await publisher.publish({ message: MESSAGE });
    const { channel } = connections[0];
    channel.confirmMode = 'manual';

    let settled = false;
    const publishing = publisher
      .publish({
        message: MESSAGE,
        options: { routingKey: 'order.custom', headers: { 'x-trace': 't-1' } },
      })
      .finally(() => {
        settled = true;
      });
    await flush();
    expect(settled).toBe(false);

    channel.confirmNext();
    const result = await publishing;
    expect(result.isOk).toBe(true);

    const [exchange, routingKey, content, properties] = channel.publish.mock.calls[1];
    expect(exchange).toBe('jaja.events');
    expect(routingKey).toBe('order.custom');
    expect(JSON.parse(content.toString())).toEqual({
      messageId: MESSAGE.messageId,
      type: 'messaging.test-event',
      payload: MESSAGE.payload,
      metadata: MESSAGE.metadata,
      occurredAt: '2026-09-14T12:30:45.678Z',
    });
    expect(properties).toEqual({
      persistent: true,
      contentType: 'application/json',
      messageId: MESSAGE.messageId,
      type: 'messaging.test-event',
      timestamp: Math.floor(MESSAGE.occurredAt.getTime() / 1000),
      appId: 'jaja-backend',
      headers: { 'x-trace': 't-1' },
    });
  });

  it('uses the message type as routing key when the options have none', async () => {
    const publisher = createPublisher();

    await publisher.publish({ message: MESSAGE });

    expect(connections[0].channel.publish.mock.calls[0][1]).toBe('messaging.test-event');
  });

  it('fails with MESSAGE_PUBLISH_FAILED when the broker nacks the message', async () => {
    const publisher = createPublisher();
    await publisher.publish({ message: MESSAGE });
    connections[0].channel.confirmMode = 'nack';

    const result = await publisher.publish({ message: MESSAGE });

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual([MessagingErrors.MESSAGE_PUBLISH_FAILED]);
  });

  it('fails with MESSAGE_BROKER_UNAVAILABLE and connects again on the next call', async () => {
    const publisher = createPublisher();
    connectMock.mockRejectedValueOnce(connectionRefused());

    const failed = await publisher.publish({ message: MESSAGE });
    expect(failed.errors).toEqual([MessagingErrors.MESSAGE_BROKER_UNAVAILABLE]);

    const succeeded = await publisher.publish({ message: MESSAGE });
    expect(succeeded.isOk).toBe(true);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('opens a single connection for simultaneous publications', async () => {
    const publisher = createPublisher();

    const results = await Promise.all([
      publisher.publish({ message: MESSAGE }),
      publisher.publish({ message: MESSAGE }),
    ]);

    expect(results.every((result) => result.isOk)).toBe(true);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connections[0].channel.publish).toHaveBeenCalledTimes(2);
  });

  it('discards the connection on close and reconnects on the next publication', async () => {
    const publisher = createPublisher();
    await publisher.publish({ message: MESSAGE });

    connections[0].emit('close');
    const result = await publisher.publish({ message: MESSAGE });

    expect(result.isOk).toBe(true);
    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(connections[1].channel.publish).toHaveBeenCalledTimes(1);
  });

  it('discards the connection on a channel error without crashing', async () => {
    const publisher = createPublisher();
    await publisher.publish({ message: MESSAGE });

    connections[0].channel.emit('error', new Error('PRECONDITION_FAILED'));
    await publisher.publish({ message: MESSAGE });

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(connections[0].close).toHaveBeenCalled();
  });

  it('never logs nor returns the password of the URL', async () => {
    const publisher = createPublisher({ url: URL_WITH_SECRET });
    connectMock.mockRejectedValue(connectionRefused());

    publisher.onModuleInit();
    await flush();
    const result = await publisher.publish({ message: MESSAGE });

    expect(result.errors).toEqual([MessagingErrors.MESSAGE_BROKER_UNAVAILABLE]);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.some((line) => line.includes('localhost:5999'))).toBe(true);
    expect(logged.some((line) => line.includes(PASSWORD))).toBe(false);
    expect(result.errors.some((error) => error.includes(PASSWORD))).toBe(false);
  });

  it('logs the reasons of a connection refused on every address, without the password', async () => {
    const publisher = createPublisher({ url: URL_WITH_SECRET });
    connectMock.mockRejectedValueOnce(
      new AggregateError(
        [new Error('connect ECONNREFUSED 127.0.0.1:5999'), new Error('connect ECONNREFUSED ::1:5999')],
        '',
      ),
    );

    const result = await publisher.publish({ message: MESSAGE });

    expect(result.errors).toEqual([MessagingErrors.MESSAGE_BROKER_UNAVAILABLE]);
    const warning = logged.find((line) => line.includes('RabbitMQ unavailable'));
    expect(warning).toContain('localhost:5999');
    expect(warning).toContain('connect ECONNREFUSED 127.0.0.1:5999; connect ECONNREFUSED ::1:5999');
    expect(logged.some((line) => line.includes(PASSWORD))).toBe(false);
  });

  it('onModuleInit tries to connect without throwing and onModuleDestroy closes everything', async () => {
    const publisher = createPublisher();

    publisher.onModuleInit();
    await flush();
    expect(connectMock).toHaveBeenCalledTimes(1);

    const { channel } = connections[0];
    await publisher.onModuleDestroy();
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connections[0].close).toHaveBeenCalledTimes(1);

    const result = await publisher.publish({ message: MESSAGE });
    expect(result.errors).toEqual([MessagingErrors.MESSAGE_BROKER_UNAVAILABLE]);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});
