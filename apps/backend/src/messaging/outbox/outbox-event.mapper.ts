import type { DomainEvent } from '@mentoria-360/shared';
import type { Prisma } from '@prisma/client';
import type { MessageCausation } from '../consumer/message-causation.js';

// Columns written by `DomainEventPrisma.append`; `status`, `attempts` and
// `available_at` come from the database defaults.
export interface OutboxEventRow {
  readonly id: string;
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Prisma.InputJsonObject;
  readonly metadata: Prisma.InputJsonObject;
  readonly occurredAt: Date;
}

// A stored event as read by the relay (`jsonb` columns already parsed).
export interface StoredOutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
  readonly metadata: unknown;
  readonly occurredAt: Date | string;
}

// `causation` is given when the event is stored inside a consumer: its
// `causationId` and `correlationId` are added to the `metadata` only when the
// event does not have these keys yet (the event wins). Without it, the
// `metadata` is stored as it came.
export function toOutboxEventRow(
  event: DomainEvent,
  causation?: MessageCausation | null,
): OutboxEventRow {
  return {
    id: event.id,
    type: event.type,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: toJsonObject(event.payload),
    metadata: toJsonObject(withCausation(event.metadata, causation)),
    occurredAt: event.occurredAt,
  };
}

// Returns a plain object that satisfies `DomainEvent`, ready for
// `domainEventToBrokerMessage`.
export function toDomainEvent(row: StoredOutboxEvent): DomainEvent {
  return {
    id: row.id,
    type: row.type,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload: asRecord(row.payload),
    metadata: asRecord(row.metadata),
    occurredAt: row.occurredAt instanceof Date ? row.occurredAt : new Date(row.occurredAt),
  };
}

function withCausation(
  metadata: Record<string, unknown> | undefined,
  causation?: MessageCausation | null,
): Record<string, unknown> | undefined {
  if (!causation) return metadata;
  // Spread order: the keys of the event come last, so they are kept.
  return { ...causation, ...withoutUndefined(metadata) };
}

function withoutUndefined(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, item]) => item !== undefined));
}

// JSON round trip: dates inside the object become ISO 8601 text and `undefined`
// fields are dropped, which is exactly what the `jsonb` column will hold.
function toJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonObject;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
