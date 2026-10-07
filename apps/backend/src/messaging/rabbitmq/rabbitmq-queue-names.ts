import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';

// How the RabbitMQ adapter turns a `BrokerSubscription` into queues and
// bindings. Nothing outside `rabbitmq/` knows these names.

const QUEUE_PREFIX = 'jaja.';
// Topic exchange wildcard: every routing key.
export const ALL_EVENTS_ROUTING_KEY = '#';

// `work` subscription: one durable queue shared by every instance.
export function workQueueOf(name: string): string {
  return `${QUEUE_PREFIX}${name}`;
}

// `broadcast` subscription: one queue per instance,
// `jaja.<name>.<host>.<pid>.<6 random characters>`, only with `[a-z0-9.-]`.
// Created once per subscription, so a reconnection declares the same name again.
export function broadcastQueueOf(name: string, host = hostname(), pid = process.pid): string {
  const suffix = randomBytes(3).toString('hex');
  const safeHost =
    host
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '') || 'host';
  return `${workQueueOf(name)}.${safeHost}.${pid}.${suffix}`;
}

export function waitQueueOf(queue: string): string {
  return `${queue}.wait`;
}

export function deadQueueOf(queue: string): string {
  return `${queue}.dead`;
}

// The event type is the routing key of each message (see the publisher); no
// event types means every event.
export function routingKeysOf(eventTypes: readonly string[]): string[] {
  return eventTypes.length ? [...eventTypes] : [ALL_EVENTS_ROUTING_KEY];
}
