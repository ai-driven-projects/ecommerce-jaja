import { describe, expect, it } from 'vitest';
import { MessagingErrors } from '../../../src/messaging/messaging-errors.js';
import { parseBrokerMessage } from '../../../src/messaging/rabbitmq/broker-message.parser.js';

const BODY = {
  messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
  type: 'order.placed',
  payload: { orderId: 'o-1', aggregateType: 'Order' },
  metadata: { correlationId: 'chain-1' },
  occurredAt: '2026-09-14T12:30:45.678Z',
};

const bufferOf = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('parseBrokerMessage', () => {
  it('parses a valid message with occurredAt as Date', () => {
    const result = parseBrokerMessage(bufferOf(BODY));

    expect(result.isOk).toBe(true);
    expect(result.instance).toEqual({
      ...BODY,
      occurredAt: new Date('2026-09-14T12:30:45.678Z'),
    });
    expect(result.instance.occurredAt).toBeInstanceOf(Date);
  });

  it('turns a missing metadata into an empty object', () => {
    const { metadata: _metadata, ...withoutMetadata } = BODY;

    const result = parseBrokerMessage(bufferOf(withoutMetadata));

    expect(result.isOk).toBe(true);
    expect(result.instance.metadata).toEqual({});
  });

  it.each([
    { label: 'invalid JSON', content: Buffer.from('not json {') },
    { label: 'an empty body', content: Buffer.from('') },
    { label: 'a JSON array', content: bufferOf([BODY]) },
    { label: 'a JSON text', content: bufferOf('message') },
    { label: 'a missing messageId', content: bufferOf({ ...BODY, messageId: undefined }) },
    {
      label: 'a messageId that is not a uuid',
      content: bufferOf({ ...BODY, messageId: 'abc-123' }),
    },
    { label: 'a numeric messageId', content: bufferOf({ ...BODY, messageId: 42 }) },
    { label: 'an empty type', content: bufferOf({ ...BODY, type: '' }) },
    { label: 'a blank type', content: bufferOf({ ...BODY, type: '  ' }) },
    { label: 'a missing payload', content: bufferOf({ ...BODY, payload: undefined }) },
    { label: 'an array payload', content: bufferOf({ ...BODY, payload: [1, 2] }) },
    { label: 'a text payload', content: bufferOf({ ...BODY, payload: 'text' }) },
    { label: 'a null payload', content: bufferOf({ ...BODY, payload: null }) },
    { label: 'a text metadata', content: bufferOf({ ...BODY, metadata: 'text' }) },
    { label: 'a null metadata', content: bufferOf({ ...BODY, metadata: null }) },
    { label: 'a missing occurredAt', content: bufferOf({ ...BODY, occurredAt: undefined }) },
    { label: 'an invalid occurredAt', content: bufferOf({ ...BODY, occurredAt: 'yesterday' }) },
    {
      label: 'an impossible occurredAt',
      content: bufferOf({ ...BODY, occurredAt: '2026-13-45T99:00:00Z' }),
    },
    {
      label: 'a numeric occurredAt',
      content: bufferOf({ ...BODY, occurredAt: 1_757_853_045_678 }),
    },
  ])('fails with MESSAGE_INVALID for $label', ({ content }) => {
    const result = parseBrokerMessage(content);

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual([MessagingErrors.MESSAGE_INVALID]);
  });
});
