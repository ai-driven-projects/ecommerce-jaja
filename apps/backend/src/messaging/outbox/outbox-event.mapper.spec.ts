import { DomainEvent, domainEventToBrokerMessage } from '@mentoria-360/shared';
import { describe, expect, it } from 'vitest';
import { toDomainEvent, toOutboxEventRow } from './outbox-event.mapper.js';

const EVENT: DomainEvent = {
  id: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
  type: 'messaging.test-event',
  aggregateType: 'MessagingTest',
  aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d',
  payload: { name: 'Pedido 1', totalCents: 1990, tags: ['a', 'b'] },
  metadata: { correlationId: 'abc-123' },
  occurredAt: new Date('2026-09-14T12:30:00.000Z'),
};

describe('outbox event mapper', () => {
  it('maps an event to a row preserving every field', () => {
    const row = toOutboxEventRow(EVENT);

    expect(row).toEqual({
      id: EVENT.id,
      type: 'messaging.test-event',
      aggregateType: 'MessagingTest',
      aggregateId: EVENT.aggregateId,
      payload: { name: 'Pedido 1', totalCents: 1990, tags: ['a', 'b'] },
      metadata: { correlationId: 'abc-123' },
      occurredAt: new Date('2026-09-14T12:30:00.000Z'),
    });
    expect(row.occurredAt).toBeInstanceOf(Date);
  });

  it('stores dates inside payload and metadata as ISO 8601 text', () => {
    const row = toOutboxEventRow({
      ...EVENT,
      payload: { paidAt: new Date('2026-09-14T13:00:00.000Z'), nested: { at: new Date(0) } },
      metadata: { receivedAt: new Date('2026-09-14T13:00:01.500Z') },
    });

    expect(row.payload).toEqual({
      paidAt: '2026-09-14T13:00:00.000Z',
      nested: { at: '1970-01-01T00:00:00.000Z' },
    });
    expect(row.metadata).toEqual({ receivedAt: '2026-09-14T13:00:01.500Z' });
  });

  it('turns a stored row into a DomainEvent that becomes a broker message', () => {
    const event = toDomainEvent({
      id: EVENT.id,
      type: EVENT.type,
      aggregateType: EVENT.aggregateType,
      aggregateId: EVENT.aggregateId,
      payload: { name: 'Pedido 1', paidAt: '2026-09-14T13:00:00.000Z' },
      metadata: { correlationId: 'abc-123' },
      occurredAt: new Date('2026-09-14T12:30:00.000Z'),
    });

    const message = domainEventToBrokerMessage(event);

    expect(message.messageId).toBe(EVENT.id);
    expect(message.type).toBe('messaging.test-event');
    expect(message.payload).toEqual({
      name: 'Pedido 1',
      paidAt: '2026-09-14T13:00:00.000Z',
      aggregateId: EVENT.aggregateId,
      aggregateType: 'MessagingTest',
    });
    expect(message.metadata).toEqual({ correlationId: 'abc-123' });
    expect(message.occurredAt).toEqual(new Date('2026-09-14T12:30:00.000Z'));
  });

  it('falls back to empty objects and parses a textual occurredAt', () => {
    const event = toDomainEvent({
      ...EVENT,
      payload: null,
      metadata: ['not', 'an', 'object'],
      occurredAt: '2026-09-14T12:30:00.000Z',
    });

    expect(event.payload).toEqual({});
    expect(event.metadata).toEqual({});
    expect(event.occurredAt).toEqual(new Date('2026-09-14T12:30:00.000Z'));
  });
});
