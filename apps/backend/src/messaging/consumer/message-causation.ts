import type { BrokerMessage, TransactionContext } from '@mentoria-360/shared';
import type { PrismaTransactionContext } from '../../db/prisma.service.js';

// Where an event stored by a consumer comes from:
// - `causationId`: the `messageId` of the message that caused the event;
// - `correlationId`: the id shared by every event of the same flow (the one of
//   the message, or its `messageId` when it starts the chain).
export interface MessageCausation {
  readonly causationId: string;
  readonly correlationId: string;
}

// Transaction of a consumer processing a message: the Prisma transaction plus
// the causation that `DomainEventPrisma.append` copies into the `metadata` of
// the events stored in it. The domain modules never see this type.
export interface ConsumerTransactionContext extends PrismaTransactionContext {
  readonly causation: MessageCausation;
}

export function causationOf(message: BrokerMessage): MessageCausation {
  const correlationId = message.metadata?.correlationId;
  return {
    causationId: message.messageId,
    correlationId:
      typeof correlationId === 'string' && correlationId.trim() ? correlationId : message.messageId,
  };
}

// The causation of a transaction context, or `null` when the transaction was not
// opened by a consumer (e.g. a use case called by a controller). Reads the
// context without depending on its concrete type.
export function readCausation(tx?: TransactionContext): MessageCausation | null {
  const causation = (tx as { causation?: unknown } | undefined)?.causation;
  if (causation === null || typeof causation !== 'object') return null;

  const { causationId, correlationId } = causation as Record<string, unknown>;
  return isText(causationId) && isText(correlationId) ? { causationId, correlationId } : null;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
