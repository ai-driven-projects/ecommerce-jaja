import { Injectable } from '@nestjs/common';
import type { BrokerMessage } from '@mentoria-360/shared';
import { Prisma } from '@prisma/client';
import type { PrismaTransactionContext } from '../../db/prisma.service.js';

// Access of the consumers to `processed_messages`, the table that makes each
// message take effect once per consumer. The domain modules never see it.
@Injectable()
export class ProcessedMessagePrisma {
  /**
   * Marks `message` as processed by `consumer` inside the transaction of the
   * consumer. Returns `true` when the row was inserted (first time) and `false`
   * when it already existed (a repeated message, which must be skipped).
   *
   * Two simultaneous deliveries of the same message wait for each other on the
   * primary key: the second insert blocks until the first transaction ends and
   * then finds the conflict (after a commit) or inserts the row (after a
   * rollback), so the handler takes effect only once.
   */
  async markProcessed(
    consumer: string,
    message: BrokerMessage,
    tx: PrismaTransactionContext,
  ): Promise<boolean> {
    const inserted = await tx.client.$executeRaw(Prisma.sql`
      INSERT INTO processed_messages (consumer, message_id, message_type)
      VALUES (${consumer}, ${message.messageId}::uuid, ${message.type})
      ON CONFLICT (consumer, message_id) DO NOTHING`);
    return inserted > 0;
  }
}
