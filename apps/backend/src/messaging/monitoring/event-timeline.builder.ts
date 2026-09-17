import { DomainEventStatus } from '@mentoria-360/shared';
import type {
  EventTimelineConsumer,
  EventTimelineEntry,
  EventTimelineEventRow,
  EventTimelineMarkRow,
  EventTimelineRegisteredConsumer,
} from './event-timeline.types.js';

/**
 * Builds the timeline of the events of an aggregate (pure function):
 * - events in chronological order (`occurredAt`, then `id`);
 * - `causationId` and `correlationId` read from `metadata` (text only, else
 *   `null`);
 * - for each event, the consumers registered for its `type`, in the order of
 *   registration, then the consumers that have a mark but are not registered
 *   for the type (`registered: false`, `delayMs` `null`), by `processedAt` and
 *   name;
 * - `state`: `processed` with the mark, `event-pending` while the event is
 *   `PENDING`, otherwise `waiting`, with `expectedAt = publishedAt + delayMs`
 *   (or `null` without both).
 */
export function buildEventTimeline(
  events: readonly EventTimelineEventRow[],
  marks: readonly EventTimelineMarkRow[],
  consumers: readonly EventTimelineRegisteredConsumer[],
): EventTimelineEntry[] {
  return [...events].sort(byOccurrence).map((event) => {
    const marksOfEvent = marks.filter((mark) => mark.messageId === event.id);
    const registered = consumers.filter((consumer) => consumer.eventType === event.type);

    const registeredEntries = registered.map((consumer) =>
      toConsumer(event, consumer.name, consumer.delayMs ?? null, true, marksOfEvent),
    );
    const unregisteredEntries = marksOfEvent
      .filter((mark) => !registered.some((consumer) => consumer.name === mark.consumer))
      .sort(
        (a, b) =>
          a.processedAt.getTime() - b.processedAt.getTime() || a.consumer.localeCompare(b.consumer),
      )
      .map((mark) => toConsumer(event, mark.consumer, null, false, marksOfEvent));

    return {
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
      metadata: event.metadata,
      causationId: metadataText(event.metadata, 'causationId'),
      correlationId: metadataText(event.metadata, 'correlationId'),
      outbox: {
        status: event.status,
        attempts: event.attempts,
        availableAt: event.availableAt,
        publishedAt: event.publishedAt,
        lastError: event.lastError,
      },
      consumers: [...registeredEntries, ...unregisteredEntries],
    };
  });
}

function toConsumer(
  event: EventTimelineEventRow,
  name: string,
  delayMs: number | null,
  registered: boolean,
  marks: readonly EventTimelineMarkRow[],
): EventTimelineConsumer {
  const mark = marks.find((item) => item.consumer === name);
  const expectedAt =
    event.publishedAt && delayMs !== null
      ? new Date(event.publishedAt.getTime() + delayMs)
      : null;

  return {
    name,
    delayMs,
    registered,
    processedAt: mark?.processedAt ?? null,
    expectedAt,
    state: mark
      ? 'processed'
      : event.status === DomainEventStatus.PENDING
        ? 'event-pending'
        : 'waiting',
  };
}

function byOccurrence(a: EventTimelineEventRow, b: EventTimelineEventRow): number {
  const byDate = a.occurredAt.getTime() - b.occurredAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function metadataText(metadata: unknown, key: string): string | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}
