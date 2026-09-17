import { Result } from '@mentoria-360/shared';
import { describe, expect, it } from 'vitest';
import { MessagingErrors } from '../../../src/messaging/messaging-errors.js';
import type { TransactionalEventConsumer } from '../../../src/messaging/consumer/event-consumer.js';
import { EventConsumerRegistry } from '../../../src/messaging/consumer/event-consumer.registry.js';

function consumer(overrides: Partial<TransactionalEventConsumer> = {}): TransactionalEventConsumer {
  return {
    name: 'orders.approve-payment',
    eventType: 'order.placed',
    handle: async () => Result.ok(),
    ...overrides,
  };
}

describe('EventConsumerRegistry', () => {
  it('lists the valid consumers in the order of registration', () => {
    const registry = new EventConsumerRegistry();
    const first = consumer();
    const second = consumer({ name: 'orders.notify-customer2', delayMs: 1_500 });
    const third = consumer({ name: 'messaging-test.echo.v2', eventType: 'messaging.test-event' });

    registry.register(first);
    registry.register(second);
    registry.register(third);

    expect(registry.list()).toEqual([first, second, third]);
  });

  it.each([
    'approve-payment',
    'Orders.approve',
    'orders.',
    '',
    'ApprovePayment',
    '1orders.pay',
    'orders..pay',
    'orders.pay_now',
  ])('refuses the name "%s" with EVENT_CONSUMER_INVALID', (name) => {
    const registry = new EventConsumerRegistry();

    expect(() => registry.register(consumer({ name }))).toThrow(
      MessagingErrors.EVENT_CONSUMER_INVALID,
    );
    expect(registry.list()).toEqual([]);
  });

  it('includes the name in the error', () => {
    expect(() =>
      new EventConsumerRegistry().register(consumer({ name: 'Orders.approve' })),
    ).toThrow('EVENT_CONSUMER_INVALID: "Orders.approve"');
  });

  it.each(['', '   '])('refuses the event type "%s"', (eventType) => {
    expect(() => new EventConsumerRegistry().register(consumer({ eventType }))).toThrow(
      MessagingErrors.EVENT_CONSUMER_INVALID,
    );
  });

  it.each([-1, 1.5, 300_001, Number.NaN])('refuses delayMs %s', (delayMs) => {
    expect(() => new EventConsumerRegistry().register(consumer({ delayMs }))).toThrow(
      MessagingErrors.EVENT_CONSUMER_INVALID,
    );
  });

  it.each([0, 300_000])('accepts delayMs %s', (delayMs) => {
    const registry = new EventConsumerRegistry();

    registry.register(consumer({ delayMs }));

    expect(registry.list()).toHaveLength(1);
  });

  it('refuses a repeated name with EVENT_CONSUMER_DUPLICATED', () => {
    const registry = new EventConsumerRegistry();
    registry.register(consumer());

    expect(() => registry.register(consumer({ eventType: 'order.paid' }))).toThrow(
      'EVENT_CONSUMER_DUPLICATED: "orders.approve-payment"',
    );
    expect(registry.list()).toHaveLength(1);
  });

  it('does not expose the internal list', () => {
    const registry = new EventConsumerRegistry();
    registry.register(consumer());

    registry.list().pop();

    expect(registry.list()).toHaveLength(1);
  });
});
