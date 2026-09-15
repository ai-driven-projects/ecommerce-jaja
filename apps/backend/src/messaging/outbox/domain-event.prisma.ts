import { Injectable } from '@nestjs/common';
import {
  DomainEvent,
  DomainEventRepository,
  Result,
  TransactionContext,
} from '@mentoria-360/shared';
import { PrismaTransactionContext } from '../../db/prisma.service.js';
import { MessagingErrors } from '../messaging-errors.js';
import { toOutboxEventRow } from './outbox-event.mapper.js';

// The outbox side of `DomainEventRepository`: a use case calls
// `append(aggregate.pullEvents(), tx)` inside `runInTransaction`, after
// persisting the aggregate, and the events are stored as pending in that same
// transaction. The relay publishes them later.
@Injectable()
export class DomainEventPrisma implements DomainEventRepository {
  async append(events: DomainEvent[], tx?: TransactionContext): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      if (!events?.length) return Result.ok<void>();

      // Unlike the other adapters, there is no fallback to the global client:
      // an event stored outside the transaction of the aggregate could survive
      // a rollback (or be lost after a commit), which is what the outbox avoids.
      const client = (tx as PrismaTransactionContext | undefined)?.client;
      if (!client) {
        return Result.fail<void>(MessagingErrors.MESSAGING_TRANSACTION_REQUIRED);
      }

      // `status`, `attempts` and `available_at` come from the database defaults.
      // The event id is the primary key: storing the same event twice fails and
      // rolls the transaction back.
      await client.outboxEvent.createMany({ data: events.map(toOutboxEventRow) });
      return Result.ok<void>();
    });
  }
}
