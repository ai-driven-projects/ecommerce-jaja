import { describe, expect, it } from 'vitest';
import {
  broadcastQueueOf,
  deadQueueOf,
  routingKeysOf,
  waitQueueOf,
  workQueueOf,
} from '../../../src/messaging/rabbitmq/rabbitmq-queue-names.js';

describe('RabbitMQ queue names', () => {
  it('names the work queue jaja.<name>, with .wait and .dead beside it', () => {
    const queue = workQueueOf('orders.approve-payment');

    expect(queue).toBe('jaja.orders.approve-payment');
    expect(waitQueueOf(queue)).toBe('jaja.orders.approve-payment.wait');
    expect(deadQueueOf(queue)).toBe('jaja.orders.approve-payment.dead');
  });

  it('names the broadcast queue jaja.<name>.<host>.<pid>.<suffix> with only [a-z0-9.-]', () => {
    expect(broadcastQueueOf('live', 'Leo_MacBook Pro.local', 4242)).toMatch(
      /^jaja\.live\.leo-macbook-pro\.local\.4242\.[a-z0-9]{6}$/,
    );
  });

  it('uses a different broadcast queue on each call', () => {
    expect(broadcastQueueOf('live', 'host', 1)).not.toBe(broadcastQueueOf('live', 'host', 1));
  });

  it('turns the event types into routing keys, and no event types into #', () => {
    expect(routingKeysOf(['order.placed', 'order.paid'])).toEqual(['order.placed', 'order.paid']);
    expect(routingKeysOf([])).toEqual(['#']);
  });
});
