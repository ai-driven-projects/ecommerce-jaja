import { Injectable } from '@nestjs/common';
import { MessagingErrors } from '../messaging-errors.js';
import type { TransactionalEventConsumer } from './event-consumer.js';

const NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
const MAX_DELAY_MS = 300_000;

/**
 * Consumers of events known by the backend. The business modules inject this
 * registry (exported by `MessagingModule`) and call `register` in their
 * `onModuleInit`: Nest runs `onModuleInit` in every module before any
 * `onApplicationBootstrap`, where `EventConsumerRunner` subscribes the consumers.
 *
 * An invalid or repeated registration is a programming error: it throws, so the
 * backend does not finish starting.
 */
@Injectable()
export class EventConsumerRegistry {
  private readonly consumers: TransactionalEventConsumer[] = [];

  register(consumer: TransactionalEventConsumer): void {
    const name = typeof consumer?.name === 'string' ? consumer.name : '';
    if (!isValid(consumer)) {
      throw new Error(`${MessagingErrors.EVENT_CONSUMER_INVALID}: "${name}"`);
    }
    if (this.consumers.some((item) => item.name === name)) {
      throw new Error(`${MessagingErrors.EVENT_CONSUMER_DUPLICATED}: "${name}"`);
    }
    this.consumers.push(consumer);
  }

  // In the order of registration.
  list(): TransactionalEventConsumer[] {
    return [...this.consumers];
  }
}

function isValid(consumer: TransactionalEventConsumer | undefined): boolean {
  if (!consumer || typeof consumer.handle !== 'function') return false;
  if (typeof consumer.name !== 'string' || !NAME_PATTERN.test(consumer.name)) return false;
  if (typeof consumer.eventType !== 'string' || !consumer.eventType.trim()) return false;

  const { delayMs } = consumer;
  return (
    delayMs === undefined || (Number.isInteger(delayMs) && delayMs >= 0 && delayMs <= MAX_DELAY_MS)
  );
}
