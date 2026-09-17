import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { BrokerMessage, Result } from '@mentoria-360/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessagingErrors } from '../messaging-errors.js';
import {
  RabbitMqConsumerConfig,
  RabbitMqMessageConsumer,
  RabbitMqSubscription,
} from './rabbitmq-message.consumer.js';

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock('amqplib', () => ({
  default: { connect: connectMock },
  connect: connectMock,
}));

const LOG_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;
const PASSWORD = 's3nh4';
const URL_WITH_SECRET = `amqp://usuario:${PASSWORD}@localhost:5999`;
const QUEUE = 'jaja.orders.approve-payment';
const MESSAGE_ID = '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11';
const TIMESTAMP = 1_757_853_045;

const BODY = {
  messageId: MESSAGE_ID,
  type: 'order.placed',
  payload: { email: 'cliente@exemplo.com' },
  metadata: { correlationId: 'chain-1' },
  occurredAt: '2026-09-14T12:30:45.678Z',
};

type ConfirmCallback = (error: unknown, ok?: object) => void;
type DeliveryCallback = (message: FakeDelivery | null) => void;

interface FakeDelivery {
  content: Buffer;
  fields: { deliveryTag: number; redelivered: boolean; routingKey: string };
  properties: {
    messageId?: string;
    type?: string;
    timestamp?: number;
    contentType?: string;
    headers?: Record<string, unknown>;
  };
}

class FakeChannel extends EventEmitter {
  // 'ack' and 'nack' confirm on the next turn; 'manual' waits for `confirmNext`.
  confirmMode: 'ack' | 'nack' | 'manual' = 'ack';
  onDelivery: DeliveryCallback | null = null;
  private readonly pending: ConfirmCallback[] = [];
  private isClosed = false;

  prefetch = vi.fn(async () => ({}));
  assertExchange = vi.fn(async (exchange: string) => ({ exchange }));
  assertQueue = vi.fn(async (queue: string) => ({ queue, messageCount: 0, consumerCount: 0 }));
  bindQueue = vi.fn(async () => ({}));
  consume = vi.fn(async (_queue: string, callback: DeliveryCallback) => {
    this.onDelivery = callback;
    return { consumerTag: `ctag-${Math.random()}` };
  });
  cancel = vi.fn(async () => ({}));
  ack = vi.fn();
  nack = vi.fn();
  close = vi.fn(async () => {
    this.closeByBroker();
  });
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

  closeByBroker(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.emit('close');
  }
}

class FakeConnection extends EventEmitter {
  readonly channels: FakeChannel[] = [];
  createConfirmChannel = vi.fn(async () => {
    const channel = new FakeChannel();
    this.channels.push(channel);
    return channel;
  });
  close = vi.fn(async () => undefined);
}

function createConsumer(overrides: Partial<RabbitMqConsumerConfig> = {}) {
  return new RabbitMqMessageConsumer({
    url: 'amqp://jaja:jaja@localhost:5672',
    exchange: 'jaja.events',
    prefetch: 10,
    maxAttempts: 5,
    ...overrides,
  });
}

function subscription(overrides: Partial<RabbitMqSubscription> = {}) {
  const onMessage = vi.fn<(message: BrokerMessage) => Promise<Result<void>>>(async () =>
    Result.ok(),
  );
  return {
    input: { queue: QUEUE, routingKeys: ['order.placed'], onMessage, ...overrides },
    onMessage,
  };
}

function delivery(
  headers?: Record<string, unknown>,
  content: Buffer = Buffer.from(JSON.stringify(BODY)),
): FakeDelivery {
  return {
    content,
    fields: { deliveryTag: 1, redelivered: false, routingKey: 'order.placed' },
    properties: {
      messageId: MESSAGE_ID,
      type: 'order.placed',
      timestamp: TIMESTAMP,
      contentType: 'application/json',
      headers,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Only `setTimeout` is fake, so a real `setImmediate` lets every pending
// promise and fake confirmation run.
async function settle(turns = 5): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('RabbitMqMessageConsumer', () => {
  let logged: { level: string; text: string }[];
  let connections: FakeConnection[];

  const channelOf = (index = 0, connection = 0) => connections[connection].channels[index];
  const lines = () => logged.map((line) => line.text);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    logged = [];
    for (const level of LOG_LEVELS) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => {
        logged.push({ level, text: args.map((arg) => String(arg)).join(' ') });
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function subscribed(
    overrides: Partial<RabbitMqSubscription> = {},
    config: Partial<RabbitMqConsumerConfig> = {},
  ) {
    const consumer = createConsumer(config);
    const { input, onMessage } = subscription(overrides);
    const result = await consumer.subscribe(input);
    await settle();
    return { consumer, onMessage, result, channel: channelOf() };
  }

  async function deliverTo(channel: FakeChannel, message: FakeDelivery): Promise<void> {
    channel.onDelivery?.(message);
    await settle();
  }

  it('declares the exchange, the three queues and the bindings, and applies the prefetch', async () => {
    const { result, channel } = await subscribed(
      { routingKeys: ['order.placed', 'order.paid'] },
      { prefetch: 7 },
    );

    expect(result.isOk).toBe(true);
    expect(connectMock).toHaveBeenCalledWith('amqp://jaja:jaja@localhost:5672', { timeout: 5_000 });
    expect(connections[0].createConfirmChannel).toHaveBeenCalledTimes(1);
    expect(channel.prefetch).toHaveBeenCalledWith(7);
    expect(channel.assertExchange).toHaveBeenCalledWith('jaja.events', 'topic', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith(QUEUE, { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith(`${QUEUE}.wait`, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': QUEUE },
    });
    expect(channel.assertQueue).toHaveBeenCalledWith(`${QUEUE}.dead`, { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledTimes(2);
    expect(channel.bindQueue).toHaveBeenCalledWith(QUEUE, 'jaja.events', 'order.placed');
    expect(channel.bindQueue).toHaveBeenCalledWith(QUEUE, 'jaja.events', 'order.paid');
    expect(channel.consume).toHaveBeenCalledWith(QUEUE, expect.any(Function), { noAck: false });
    expect(lines()).toContain(`Consumindo ${QUEUE} (order.placed, order.paid)`);
  });

  it('uses one connection and one channel per subscription', async () => {
    const consumer = createConsumer();

    await consumer.subscribe(subscription().input);
    await consumer.subscribe(subscription({ queue: 'jaja.orders.ship-order' }).input);
    await settle();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connections[0].channels).toHaveLength(2);
    expect(connections[0].channels[1].consume).toHaveBeenCalledWith(
      'jaja.orders.ship-order',
      expect.any(Function),
      { noAck: false },
    );
  });

  it.each([
    { label: 'an empty queue', overrides: { queue: '' } },
    { label: 'a blank queue', overrides: { queue: '   ' } },
    { label: 'no routing keys', overrides: { routingKeys: [] } },
    { label: 'an empty routing key', overrides: { routingKeys: [''] } },
    { label: 'a negative delay', overrides: { delayMs: -1 } },
  ])('refuses a subscription with $label', async ({ overrides }) => {
    const consumer = createConsumer();

    const result = await consumer.subscribe(subscription(overrides).input);

    expect(result.errors).toEqual([MessagingErrors.MESSAGE_SUBSCRIPTION_INVALID]);
    await settle();
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('refuses a queue that is already subscribed', async () => {
    const { consumer } = await subscribed();

    const result = await consumer.subscribe(subscription().input);

    expect(result.errors).toEqual([MessagingErrors.MESSAGE_SUBSCRIPTION_INVALID]);
    expect(connections[0].channels).toHaveLength(1);
  });

  it('acks a message processed with success', async () => {
    const { channel, onMessage } = await subscribed();
    const message = delivery();

    await deliverTo(channel, message);

    expect(onMessage).toHaveBeenCalledWith({
      ...BODY,
      occurredAt: new Date('2026-09-14T12:30:45.678Z'),
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('sends a failure of attempt 1 of 5 to .wait and acks only after the confirmation', async () => {
    const { channel, onMessage } = await subscribed();
    onMessage.mockResolvedValueOnce(Result.fail(['ORDER_NOT_FOUND', 'ORDER_INVALID']));
    channel.confirmMode = 'manual';
    const message = delivery({ 'x-trace': 't-1' });

    await deliverTo(channel, message);

    expect(channel.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, content, options] = channel.publish.mock.calls[0];
    expect(exchange).toBe('');
    expect(routingKey).toBe(`${QUEUE}.wait`);
    expect(content).toBe(message.content);
    expect(options).toEqual({
      persistent: true,
      messageId: MESSAGE_ID,
      type: 'order.placed',
      timestamp: TIMESTAMP,
      contentType: 'application/json',
      expiration: '1000',
      headers: {
        'x-trace': 't-1',
        'x-jaja-attempt': 2,
        'x-jaja-last-error': 'ORDER_NOT_FOUND, ORDER_INVALID',
      },
    });
    expect(channel.ack).not.toHaveBeenCalled();

    channel.confirmNext();
    await settle();

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
    const warning = logged.find((line) => line.level === 'warn');
    expect(warning?.text).toContain(MESSAGE_ID);
    expect(warning?.text).toContain('order.placed');
    expect(warning?.text).toContain('attempt 1 of 5');
    expect(warning?.text).toContain('1000 ms');
  });

  it('waits 2^(attempt - 1) seconds before the next attempts', async () => {
    const { channel, onMessage } = await subscribed();
    onMessage.mockResolvedValue(Result.fail('ORDER_INVALID'));

    await deliverTo(channel, delivery({ 'x-jaja-attempt': 3 }));

    const [, , , options] = channel.publish.mock.calls[0];
    expect(options).toMatchObject({
      expiration: '4000',
      headers: { 'x-jaja-attempt': 4 },
    });
  });

  it('discards to .dead with MAX_ATTEMPTS_EXCEEDED on the last attempt', async () => {
    const { channel, onMessage } = await subscribed();
    onMessage.mockResolvedValueOnce(Result.fail('ORDER_INVALID'));
    const message = delivery({ 'x-jaja-attempt': 5, 'x-jaja-last-error': 'OLD' });

    await deliverTo(channel, message);

    const [exchange, routingKey, , options] = channel.publish.mock.calls[0];
    expect(exchange).toBe('');
    expect(routingKey).toBe(`${QUEUE}.dead`);
    expect(options).not.toHaveProperty('expiration');
    expect(options).toMatchObject({
      persistent: true,
      headers: {
        'x-jaja-dead-reason': 'MAX_ATTEMPTS_EXCEEDED',
        'x-jaja-attempt': 5,
        'x-jaja-last-error': 'ORDER_INVALID',
      },
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
    const error = logged.find((line) => line.level === 'error');
    expect(error?.text).toContain(MESSAGE_ID);
    expect(error?.text).toContain('MAX_ATTEMPTS_EXCEEDED');
  });

  it('counts an exception of onMessage as a failure', async () => {
    const { channel, onMessage } = await subscribed();
    onMessage.mockRejectedValueOnce(new Error('boom'));

    await deliverTo(channel, delivery());

    const [, routingKey, , options] = channel.publish.mock.calls[0];
    expect(routingKey).toBe(`${QUEUE}.wait`);
    expect(options).toMatchObject({
      headers: { 'x-jaja-attempt': 2, 'x-jaja-last-error': 'boom' },
    });
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('keeps the last error within 500 characters', async () => {
    const { channel, onMessage } = await subscribed();
    onMessage.mockResolvedValueOnce(Result.fail('E'.repeat(800)));

    await deliverTo(channel, delivery());

    const [, , , options] = channel.publish.mock.calls[0];
    expect(
      (options as { headers: Record<string, string> }).headers['x-jaja-last-error'],
    ).toHaveLength(500);
  });

  it('discards an invalid body to .dead with MESSAGE_INVALID without calling onMessage', async () => {
    const { channel, onMessage } = await subscribed();
    const message = delivery(undefined, Buffer.from('not json'));

    await deliverTo(channel, message);

    expect(onMessage).not.toHaveBeenCalled();
    const [, routingKey, content, options] = channel.publish.mock.calls[0];
    expect(routingKey).toBe(`${QUEUE}.dead`);
    expect(content).toBe(message.content);
    expect(options).toMatchObject({ headers: { 'x-jaja-dead-reason': 'MESSAGE_INVALID' } });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('sends the first delivery of a delayed subscription to .wait and processes the next one', async () => {
    const { channel, onMessage } = await subscribed({ delayMs: 1_500 });
    const first = delivery();

    await deliverTo(channel, first);

    expect(onMessage).not.toHaveBeenCalled();
    const [, routingKey, , options] = channel.publish.mock.calls[0];
    expect(routingKey).toBe(`${QUEUE}.wait`);
    expect(options).toMatchObject({ expiration: '1500', headers: { 'x-jaja-delayed': true } });
    expect(channel.ack).toHaveBeenCalledWith(first);

    const second = delivery({ 'x-jaja-delayed': true });
    await deliverTo(channel, second);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(second);
    expect(channel.publish).toHaveBeenCalledTimes(1);
  });

  it('does not repeat the initial wait on a retry', async () => {
    const { channel, onMessage } = await subscribed({ delayMs: 1_500 });
    onMessage.mockResolvedValueOnce(Result.fail('ORDER_INVALID'));

    await deliverTo(channel, delivery({ 'x-jaja-delayed': true }));

    const [, , , options] = channel.publish.mock.calls[0];
    expect(options).toMatchObject({
      expiration: '1000',
      headers: { 'x-jaja-delayed': true, 'x-jaja-attempt': 2 },
    });
  });

  it('returns the message to its queue with nack when the republication is not confirmed', async () => {
    const { channel, onMessage } = await subscribed();
    onMessage.mockResolvedValueOnce(Result.fail('ORDER_INVALID'));
    channel.confirmMode = 'nack';
    const message = delivery();

    await deliverTo(channel, message);

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('accepts the subscription with the broker down, warns without the password and reconnects later', async () => {
    connectMock.mockRejectedValueOnce(
      new Error(`connect ECONNREFUSED 127.0.0.1:5999 while opening ${URL_WITH_SECRET}`),
    );
    const consumer = createConsumer({ url: URL_WITH_SECRET });

    const first = await consumer.subscribe(subscription().input);
    const second = await consumer.subscribe(
      subscription({ queue: 'jaja.orders.ship-order' }).input,
    );
    await settle();

    expect(first.isOk).toBe(true);
    expect(second.isOk).toBe(true);
    expect(connectMock).toHaveBeenCalledTimes(1);
    const warning = logged.find((line) => line.level === 'warn');
    expect(warning?.text).toContain('localhost:5999');
    expect(warning?.text).toContain('1000 ms');
    expect(lines().some((line) => line.includes(PASSWORD))).toBe(false);

    await vi.advanceTimersByTimeAsync(999);
    expect(connectMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(connections[0].channels.map((channel) => channel.consume.mock.calls[0][0])).toEqual([
      QUEUE,
      'jaja.orders.ship-order',
    ]);
    expect(lines().some((line) => line.includes(PASSWORD))).toBe(false);
  });

  it('waits longer on each failed reconnection', async () => {
    connectMock
      .mockRejectedValueOnce(new Error('refused'))
      .mockRejectedValueOnce(new Error('refused'));
    const consumer = createConsumer();

    await consumer.subscribe(subscription().input);
    await settle();
    await vi.advanceTimersByTimeAsync(1_000);
    await settle();
    expect(connectMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(connectMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await settle();

    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(connections[0].channels[0].consume).toHaveBeenCalledTimes(1);
  });

  it('schedules a reconnection when the connection closes and resumes the subscriptions', async () => {
    const { channel } = await subscribed();

    channel.closeByBroker();
    connections[0].emit('error', new Error('CONNECTION_FORCED'));
    connections[0].emit('close');
    await settle();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(logged.some((line) => line.text.includes('reconnecting in 1000 ms'))).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    await settle();

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(connections[1].channels).toHaveLength(1);
    expect(connections[1].channels[0].consume).toHaveBeenCalledWith(QUEUE, expect.any(Function), {
      noAck: false,
    });
  });

  it('sets up again only the subscription whose channel was closed by the broker', async () => {
    const consumer = createConsumer();
    await consumer.subscribe(subscription().input);
    await consumer.subscribe(subscription({ queue: 'jaja.orders.ship-order' }).input);
    await settle();

    connections[0].channels[0].closeByBroker();
    await vi.advanceTimersByTimeAsync(1_000);
    await settle();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connections[0].channels).toHaveLength(3);
    expect(connections[0].channels[2].consume).toHaveBeenCalledWith(QUEUE, expect.any(Function), {
      noAck: false,
    });
  });

  it('onModuleDestroy cancels the consumers and closes only after the message in processing ends', async () => {
    const { consumer, channel, onMessage } = await subscribed();
    const processing = deferred<Result<void>>();
    onMessage.mockImplementationOnce(() => processing.promise);
    const message = delivery();
    await deliverTo(channel, message);

    let destroyed = false;
    const destroying = consumer.onModuleDestroy().then(() => {
      destroyed = true;
    });
    await settle();

    const [consumerTag] = await channel.consume.mock.results[0].value.then(
      (value: { consumerTag: string }) => [value.consumerTag],
    );
    expect(channel.cancel).toHaveBeenCalledWith(consumerTag);
    expect(destroyed).toBe(false);
    expect(channel.close).not.toHaveBeenCalled();
    expect(connections[0].close).not.toHaveBeenCalled();

    processing.resolve(Result.ok());
    await destroying;

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connections[0].close).toHaveBeenCalledTimes(1);

    connections[0].emit('close');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  describe('transient subscription', () => {
    const LIVE_QUEUE = 'jaja.live.host1.4242.ab12cd';
    const transient = (overrides: Partial<RabbitMqSubscription> = {}) =>
      subscribed({ queue: LIVE_QUEUE, routingKeys: ['#'], transient: true, ...overrides });

    it('declares only a non-durable, exclusive and auto-deleted queue bound with the keys', async () => {
      const { result, channel } = await transient();

      expect(result.isOk).toBe(true);
      expect(channel.assertExchange).toHaveBeenCalledWith('jaja.events', 'topic', { durable: true });
      expect(channel.assertQueue).toHaveBeenCalledTimes(1);
      expect(channel.assertQueue).toHaveBeenCalledWith(LIVE_QUEUE, {
        durable: false,
        exclusive: true,
        autoDelete: true,
      });
      expect(channel.assertQueue).not.toHaveBeenCalledWith(`${LIVE_QUEUE}.wait`, expect.anything());
      expect(channel.assertQueue).not.toHaveBeenCalledWith(`${LIVE_QUEUE}.dead`, expect.anything());
      expect(channel.bindQueue).toHaveBeenCalledWith(LIVE_QUEUE, 'jaja.events', '#');
      expect(channel.consume).toHaveBeenCalledWith(LIVE_QUEUE, expect.any(Function), {
        noAck: false,
      });
    });

    it('acks a message processed with success', async () => {
      const { channel, onMessage } = await transient();
      const message = delivery();

      await deliverTo(channel, message);

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.publish).not.toHaveBeenCalled();
    });

    it('acks a failed message without retrying it and logs the failure without the payload', async () => {
      const { channel, onMessage } = await transient();
      onMessage.mockResolvedValueOnce(Result.fail('LIVE_FAILED'));
      const message = delivery();

      await deliverTo(channel, message);

      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.nack).not.toHaveBeenCalled();
      expect(channel.publish).not.toHaveBeenCalled();
      const warning = logged.find((line) => line.level === 'warn');
      expect(warning?.text).toContain(MESSAGE_ID);
      expect(warning?.text).toContain('LIVE_FAILED');
      expect(lines().some((line) => line.includes('cliente@exemplo.com'))).toBe(false);
    });

    it('acks a message whose onMessage throws', async () => {
      const { channel, onMessage } = await transient();
      onMessage.mockRejectedValueOnce(new Error('boom'));
      const message = delivery();

      await deliverTo(channel, message);

      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.publish).not.toHaveBeenCalled();
      expect(logged.some((line) => line.level === 'warn' && line.text.includes('boom'))).toBe(true);
    });

    it('drops an invalid body with a log and acks it without calling onMessage', async () => {
      const { channel, onMessage } = await transient();
      const message = delivery(undefined, Buffer.from('not json'));

      await deliverTo(channel, message);

      expect(onMessage).not.toHaveBeenCalled();
      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.publish).not.toHaveBeenCalled();
      const warning = logged.find((line) => line.level === 'warn');
      expect(warning?.text).toContain('MESSAGE_INVALID');
      expect(warning?.text).not.toContain('not json');
    });

    it('refuses a transient subscription with an initial wait', async () => {
      const consumer = createConsumer();

      const result = await consumer.subscribe(
        subscription({ queue: LIVE_QUEUE, routingKeys: ['#'], transient: true, delayMs: 1_000 })
          .input,
      );

      expect(result.errors).toEqual([MessagingErrors.MESSAGE_SUBSCRIPTION_INVALID]);
      await settle();
      expect(connectMock).not.toHaveBeenCalled();
    });

    it('declares the transient queue again after the connection closes', async () => {
      const { channel } = await transient();

      channel.closeByBroker();
      connections[0].emit('close');
      await settle();
      await vi.advanceTimersByTimeAsync(1_000);
      await settle();

      expect(connectMock).toHaveBeenCalledTimes(2);
      const [again] = connections[1].channels;
      expect(again.assertQueue).toHaveBeenCalledWith(LIVE_QUEUE, {
        durable: false,
        exclusive: true,
        autoDelete: true,
      });
      expect(again.bindQueue).toHaveBeenCalledWith(LIVE_QUEUE, 'jaja.events', '#');
      expect(again.consume).toHaveBeenCalledWith(LIVE_QUEUE, expect.any(Function), {
        noAck: false,
      });
    });
  });

  it('stops trying to reconnect after onModuleDestroy', async () => {
    connectMock.mockRejectedValue(new Error('refused'));
    const consumer = createConsumer();
    await consumer.subscribe(subscription().input);
    await settle();

    await consumer.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});
