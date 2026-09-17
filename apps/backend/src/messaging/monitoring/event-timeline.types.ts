import type { TransactionalEventConsumer } from '../consumer/event-consumer.js';

// Monitoring view of the events of one aggregate (e.g. the admin order
// monitor), read from the internal messaging tables (`outbox_events` and
// `processed_messages`) and the consumers registered in this instance. Dates
// are `Date` (ISO 8601 in JSON).

/**
 * State of a consumer for one event, derived from the database:
 * - `processed`: the consumer has the "processed" mark of the event;
 * - `event-pending`: no mark, and the event has not left the outbox yet;
 * - `waiting`: no mark, and the event was published (the message is waiting in
 *   the `.wait` queue or being processed). Retries and discards are not told
 *   apart: they live in the broker.
 */
export type EventTimelineConsumerState = 'event-pending' | 'waiting' | 'processed';

export interface EventTimelineConsumer {
  // Name of the consumer (`<module>.<action>`).
  name: string;
  // Wait of the consumer registered in this instance; `null` when it is not
  // registered here or was registered without a wait.
  delayMs: number | null;
  // `false` for a consumer that processed the event but is not registered in
  // this instance for its type (e.g. another instance, or the simulation off).
  registered: boolean;
  // When the mark was stored, or `null` without the mark.
  processedAt: Date | null;
  // `publishedAt + delayMs`, or `null` without both.
  expectedAt: Date | null;
  state: EventTimelineConsumerState;
}

// Situation of the event in the outbox.
export interface EventTimelineOutbox {
  // `PENDING` or `PUBLISHED` (`DomainEventStatus`).
  status: string;
  attempts: number;
  availableAt: Date;
  publishedAt: Date | null;
  lastError: string | null;
}

export interface EventTimelineEntry {
  // Id of the event, which is also the `messageId` of the broker message.
  id: string;
  type: string;
  occurredAt: Date;
  payload: unknown;
  metadata: unknown;
  // Read from `metadata`, or `null` when missing (e.g. the first event of a chain
  // has no cause).
  causationId: string | null;
  correlationId: string | null;
  outbox: EventTimelineOutbox;
  // Registered consumers of `type` (in the order of registration), then the
  // unregistered ones that processed the event.
  consumers: EventTimelineConsumer[];
}

// One row of `outbox_events` as read by `EventTimelinePrisma`.
export interface EventTimelineEventRow {
  id: string;
  type: string;
  occurredAt: Date;
  payload: unknown;
  metadata: unknown;
  status: string;
  attempts: number;
  availableAt: Date;
  publishedAt: Date | null;
  lastError: string | null;
}

// One row of `processed_messages`.
export interface EventTimelineMarkRow {
  consumer: string;
  messageId: string;
  processedAt: Date;
}

// What the timeline needs of a registered consumer.
export type EventTimelineRegisteredConsumer = Pick<
  TransactionalEventConsumer,
  'name' | 'eventType' | 'delayMs'
>;
