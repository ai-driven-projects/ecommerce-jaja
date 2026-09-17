import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrokerMessage, ConsumeMessageIn, MessageConsumer, Result } from '@mentoria-360/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RabbitMqSubscription } from '../../../src/messaging/rabbitmq/rabbitmq-message.consumer.js';
import { LiveEventFeed, liveQueueName } from '../../../src/messaging/live/live-event-feed.js';

const MESSAGE: BrokerMessage = {
  messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
  type: 'order.placed',
  payload: { aggregateType: 'Order', aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d' },
  metadata: {},
  occurredAt: new Date('2026-09-17T12:00:00.000Z'),
};

class FakeMessageConsumer implements MessageConsumer {
  readonly subscriptions: RabbitMqSubscription[] = [];
  result: Result<void> = Result.ok();

  async subscribe(input: ConsumeMessageIn): Promise<Result<void>> {
    this.subscriptions.push(input as RabbitMqSubscription);
    return this.result;
  }
}

function createFeed(env: Record<string, string | undefined> = {}) {
  const consumer = new FakeMessageConsumer();
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return { feed: new LiveEventFeed(consumer, config), consumer };
}

describe('LiveEventFeed', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not subscribe when LIVE_EVENTS_ENABLED is "false"', async () => {
    const { feed, consumer } = createFeed({ LIVE_EVENTS_ENABLED: 'false' });

    await feed.onApplicationBootstrap();

    expect(consumer.subscriptions).toHaveLength(0);
    expect(logged.some((line) => line.includes('desligado'))).toBe(true);
  });

  it.each([undefined, 'true', 'anything'])(
    'subscribes a transient jaja.live.* queue bound with # when the setting is %s',
    async (value) => {
      const { feed, consumer } = createFeed({ LIVE_EVENTS_ENABLED: value });

      await feed.onApplicationBootstrap();

      expect(consumer.subscriptions).toHaveLength(1);
      const [subscription] = consumer.subscriptions;
      expect(subscription.queue).toMatch(/^jaja\.live\./);
      expect(subscription.queue).toMatch(/^[a-z0-9.-]+$/);
      expect(subscription.queue).toMatch(new RegExp(`\\.${process.pid}\\.[a-z0-9]{6}$`));
      expect(subscription.transient).toBe(true);
      expect(subscription.delayMs).toBeUndefined();
      expect(subscription.routingKeys).toEqual(['#']);
      expect(logged.some((line) => line.includes(subscription.queue))).toBe(true);
    },
  );

  it('uses a different queue name on each start', () => {
    expect(liveQueueName('host', 1)).not.toBe(liveQueueName('host', 1));
  });

  it('keeps only [a-z0-9.-] in the host of the queue name', () => {
    expect(liveQueueName('Leo_MacBook Pro.local', 4242)).toMatch(
      /^jaja\.live\.leo-macbook-pro\.local\.4242\.[a-z0-9]{6}$/,
    );
  });

  it('emits each delivered message in events$ and always confirms it', async () => {
    const { feed, consumer } = createFeed();
    const received: BrokerMessage[] = [];
    feed.events$.subscribe((message) => received.push(message));
    await feed.onApplicationBootstrap();

    const result = await consumer.subscriptions[0].onMessage(MESSAGE);

    expect(result.isOk).toBe(true);
    expect(received).toEqual([MESSAGE]);
  });

  it('delivers the same message to every subscriber of the instance', async () => {
    const { feed, consumer } = createFeed();
    const first = vi.fn();
    const second = vi.fn();
    feed.events$.subscribe(first);
    feed.events$.subscribe(second);
    await feed.onApplicationBootstrap();

    await consumer.subscriptions[0].onMessage(MESSAGE);

    expect(first).toHaveBeenCalledWith(MESSAGE);
    expect(second).toHaveBeenCalledWith(MESSAGE);
  });

  it('throws when the subscription is refused', async () => {
    const { feed, consumer } = createFeed();
    consumer.result = Result.fail('MESSAGE_SUBSCRIPTION_INVALID');

    await expect(feed.onApplicationBootstrap()).rejects.toThrow('MESSAGE_SUBSCRIPTION_INVALID');
  });

  it('completes events$ on onModuleDestroy', () => {
    const { feed } = createFeed();
    const complete = vi.fn();
    feed.events$.subscribe({ complete });

    feed.onModuleDestroy();

    expect(complete).toHaveBeenCalledTimes(1);
  });
});
