import { Injectable } from '@nestjs/common';
import { DomainEvent, DomainEventStatus } from '@mentoria-360/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../db/prisma.service.js';
import { nextAttemptAt } from './outbox-backoff.js';
import { StoredOutboxEvent, toDomainEvent } from './outbox-event.mapper.js';
import { PublishInOrderResult } from './publish-in-order.js';

const LAST_ERROR_MAX_LENGTH = 500;

// The default of Prisma for interactive transactions is 5 s, which a large
// batch or a slow broker connection can exceed. `runInTransaction` accepts no
// options, so the relay opens its own transaction with a longer timeout (the
// RabbitMQ adapter gives up connecting after 5 s, well below it).
const TRANSACTION_TIMEOUT_MS = 30_000;

export type PublishBatch = (events: DomainEvent[]) => Promise<PublishInOrderResult>;

export interface OutboxBatchResult {
  readonly published: number;
  readonly failed: number;
}

type PendingRow = StoredOutboxEvent & { attempts: number };

// Access of the relay to `outbox_events`. The table is a detail of the backend:
// the domain modules only know `DomainEventRepository`.
@Injectable()
export class OutboxPrisma {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads, publishes and marks one batch of pending events in a single transaction:
   * 1. locks up to `limit` pending events already available, oldest first, with
   *    `FOR UPDATE SKIP LOCKED`: another relay skips the locked rows instead of
   *    waiting, so two relays never publish the same event at the same time;
   * 2. hands them to `publish`, which stops at the first failure;
   * 3. marks the published ones as `PUBLISHED`;
   * 4. keeps the failed one `PENDING`, with one more attempt, the error and the
   *    availability pushed forward (the events after it are left untouched).
   *
   * The transaction (and the row locks) stays open while the batch is published,
   * which is acceptable with small batches. Delivery is at least once: if the
   * process stops after the broker confirmed a message and before the commit,
   * the event is still pending and is published again with the same
   * `messageId`, so the future consumers must be idempotent.
   */
  async processPendingBatch(limit: number, publish: PublishBatch): Promise<OutboxBatchResult> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<PendingRow[]>(Prisma.sql`
          SELECT id::text AS id, type, aggregate_type AS "aggregateType",
            aggregate_id::text AS "aggregateId", payload, metadata,
            occurred_at AS "occurredAt", attempts
          FROM outbox_events
          WHERE status = ${DomainEventStatus.PENDING} AND available_at <= now()
          ORDER BY occurred_at, id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED`);
        if (!rows.length) return { published: 0, failed: 0 };

        const { publishedIds, failure } = await publish(rows.map(toDomainEvent));

        if (publishedIds.length) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE outbox_events
            SET status = ${DomainEventStatus.PUBLISHED}, published_at = now()
            WHERE id = ANY(${publishedIds}::uuid[])`);
        }

        if (failure) {
          const failed = rows.find((row) => row.id === failure.id);
          const attempts = (failed?.attempts ?? 0) + 1;
          await tx.outboxEvent.update({
            where: { id: failure.id },
            data: {
              attempts,
              lastError: failure.error.slice(0, LAST_ERROR_MAX_LENGTH),
              availableAt: nextAttemptAt(attempts, new Date()),
            },
          });
        }

        return { published: publishedIds.length, failed: failure ? 1 : 0 };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }
}
