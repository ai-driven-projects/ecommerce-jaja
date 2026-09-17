import { BrokerMessage, TransactionContext } from '@mentoria-360/shared';
import { describe, expect, it } from 'vitest';
import { causationOf, readCausation } from './message-causation.js';

const MESSAGE_ID = '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11';

function message(metadata: Record<string, unknown>): BrokerMessage {
  return {
    messageId: MESSAGE_ID,
    type: 'order.placed',
    payload: { orderId: 'o-1' },
    metadata,
    occurredAt: new Date('2026-09-14T12:00:00.000Z'),
  };
}

describe('causationOf', () => {
  it('inherits the correlationId of the metadata', () => {
    expect(causationOf(message({ correlationId: 'corr-1' }))).toEqual({
      causationId: MESSAGE_ID,
      correlationId: 'corr-1',
    });
  });

  it.each([
    { label: 'missing', metadata: {} },
    { label: 'empty', metadata: { correlationId: '' } },
    { label: 'blank', metadata: { correlationId: '   ' } },
    { label: 'not text', metadata: { correlationId: 42 } },
  ])('uses the messageId when the correlationId is $label', ({ metadata }) => {
    expect(causationOf(message(metadata))).toEqual({
      causationId: MESSAGE_ID,
      correlationId: MESSAGE_ID,
    });
  });
});

describe('readCausation', () => {
  it('returns the causation of the context', () => {
    const tx = { client: {}, causation: { causationId: 'a', correlationId: 'b' } };

    expect(readCausation(tx)).toEqual({ causationId: 'a', correlationId: 'b' });
  });

  it('returns null without a context or without causation', () => {
    expect(readCausation()).toBeNull();
    expect(readCausation({ client: {} } as TransactionContext)).toBeNull();
  });

  it.each([
    { label: 'null', causation: null },
    { label: 'a text', causation: 'abc' },
    { label: 'missing ids', causation: {} },
    { label: 'a numeric id', causation: { causationId: 1, correlationId: 'b' } },
    { label: 'an empty id', causation: { causationId: 'a', correlationId: '' } },
  ])('returns null when the causation is $label', ({ causation }) => {
    expect(readCausation({ causation } as TransactionContext)).toBeNull();
  });
});
