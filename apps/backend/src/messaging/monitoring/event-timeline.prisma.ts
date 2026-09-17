import { Injectable } from '@nestjs/common';
import { Id, Result } from '@mentoria-360/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../db/prisma.service.js';
import { EventConsumerRegistry } from '../consumer/event-consumer.registry.js';
import { buildEventTimeline } from './event-timeline.builder.js';
import type {
  EventTimelineEntry,
  EventTimelineEventRow,
  EventTimelineMarkRow,
} from './event-timeline.types.js';

/**
 * Monitoring read of the internal messaging tables: the events of an aggregate
 * stored in the outbox (`outbox_events`), the "processed" marks of those events
 * (`processed_messages`) and the consumers registered in **this instance**
 * (`EventConsumerRegistry`). It never queries the broker: failed attempts and
 * discards of the consumers are not here (they live in the `.wait`/`.dead`
 * queues, in the RabbitMQ panel and in `jaja broker:queues`).
 *
 * Infrastructure, outside `modules/*`: the domain does not know the outbox.
 */
@Injectable()
export class EventTimelinePrisma {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: EventConsumerRegistry,
  ) {}

  /**
   * Timeline of the events of `aggregateType`/`aggregateId`, in chronological
   * order (see `buildEventTimeline`). An `aggregateId` that is not a uuid
   * resolves to an empty list without going to the database.
   */
  async findByAggregate(
    aggregateType: string,
    aggregateId: string,
  ): Promise<Result<EventTimelineEntry[]>> {
    return Result.tryAsync(async () => {
      if (typeof aggregateId !== 'string' || !Id.isValid(aggregateId.trim())) return [];

      const client = this.prisma.client;
      const events = await client.$queryRaw<EventTimelineEventRow[]>(Prisma.sql`
        SELECT id::text AS id, type, occurred_at AS "occurredAt", payload, metadata, status,
          attempts, available_at AS "availableAt", published_at AS "publishedAt",
          last_error AS "lastError"
        FROM outbox_events
        WHERE aggregate_type = ${aggregateType} AND aggregate_id = ${aggregateId.trim()}::uuid
        ORDER BY occurred_at, id`);
      if (!events.length) return [];

      const marks = await client.$queryRaw<EventTimelineMarkRow[]>(Prisma.sql`
        SELECT consumer, message_id::text AS "messageId", processed_at AS "processedAt"
        FROM processed_messages
        WHERE message_id = ANY(${events.map((event) => event.id)}::uuid[])`);

      return buildEventTimeline(events, marks, this.registry.list());
    });
  }
}
