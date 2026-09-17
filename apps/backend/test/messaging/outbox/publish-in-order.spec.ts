import {
  DomainEvent,
  MessagePublisher,
  PublishMessageIn,
  Result,
} from '@mentoria-360/shared';
import { describe, expect, it, vi } from 'vitest';
import { publishInOrder } from '../../../src/messaging/outbox/publish-in-order.js';

function event(id: string, type: string): DomainEvent {
  return {
    id,
    type,
    aggregateType: 'MessagingTest',
    aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d',
    payload: { value: id },
    metadata: {},
    occurredAt: new Date('2026-09-14T12:00:00.000Z'),
  };
}

const EVENTS = [
  event('00000000-0000-4000-8000-000000000001', 'order.created'),
  event('00000000-0000-4000-8000-000000000002', 'order.paid'),
  event('00000000-0000-4000-8000-000000000003', 'order.shipped'),
];

function fakePublisher(
  handler: (input: PublishMessageIn) => Promise<Result<void>> = async () => Result.ok(),
) {
  const publish = vi.fn(handler);
  return { publisher: { publish } satisfies MessagePublisher, publish };
}

describe('publishInOrder', () => {
  it('publishes every event in order with the type as routing key', async () => {
    const { publisher, publish } = fakePublisher();

    const result = await publishInOrder(EVENTS, publisher);

    expect(result).toEqual({ publishedIds: EVENTS.map((item) => item.id), failure: null });
    expect(publish).toHaveBeenCalledTimes(3);
    publish.mock.calls.forEach(([input], index) => {
      expect(input.message.messageId).toBe(EVENTS[index].id);
      expect(input.message.type).toBe(EVENTS[index].type);
      expect(input.options).toEqual({ routingKey: EVENTS[index].type });
    });
  });

  it('stops at a failed Result without calling the next events', async () => {
    const { publisher, publish } = fakePublisher(async ({ message }) =>
      message.type === 'order.paid' ? Result.fail('MESSAGE_BROKER_UNAVAILABLE') : Result.ok(),
    );

    const result = await publishInOrder(EVENTS, publisher);

    expect(result).toEqual({
      publishedIds: [EVENTS[0].id],
      failure: { id: EVENTS[1].id, error: 'MESSAGE_BROKER_UNAVAILABLE' },
    });
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('counts an exception as a failure with the error message', async () => {
    const { publisher, publish } = fakePublisher(async () => {
      throw new Error('socket hang up');
    });

    const result = await publishInOrder(EVENTS, publisher);

    expect(result).toEqual({
      publishedIds: [],
      failure: { id: EVENTS[0].id, error: 'socket hang up' },
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('does not call the publisher for an empty list', async () => {
    const { publisher, publish } = fakePublisher();

    const result = await publishInOrder([], publisher);

    expect(result).toEqual({ publishedIds: [], failure: null });
    expect(publish).not.toHaveBeenCalled();
  });
});
