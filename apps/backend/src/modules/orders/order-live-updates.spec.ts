import { MessageEvent } from '@nestjs/common';
import { BrokerMessage } from '@mentoria-360/shared';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEventFeed } from '../../messaging/live/live-event-feed.js';
import { ORDER_STREAM_HEARTBEAT_MS, OrderLiveUpdates } from './order-live-updates.js';

const ORDER_ID = 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d';
const OTHER_ORDER_ID = '3f1c9a52-7b1e-4d2a-9c4f-8e6b2a1d0c55';

function message(overrides: Partial<BrokerMessage> & { payload?: Record<string, unknown> } = {}) {
  return {
    messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
    type: 'order.payment-approved',
    payload: {
      aggregateType: 'Order',
      aggregateId: ORDER_ID,
      customerId: '11111111-2222-4333-8444-555555555555',
      status: 'PAYMENT_APPROVED',
    },
    metadata: { correlationId: 'chain-1' },
    occurredAt: new Date('2026-09-17T12:00:03.000Z'),
    ...overrides,
  } satisfies BrokerMessage;
}

describe('OrderLiveUpdates', () => {
  let events: Subject<BrokerMessage>;
  let updates: OrderLiveUpdates;
  let received: MessageEvent[];
  let completed: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    events = new Subject<BrokerMessage>();
    updates = new OrderLiveUpdates({ events$: events.asObservable() } as LiveEventFeed);
    received = [];
    completed = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const subscribe = (stream: ReturnType<OrderLiveUpdates['forOrder']>) =>
    stream.subscribe({
      next: (event) => received.push(event),
      complete: () => {
        completed = true;
      },
    });

  const listen = (orderId = ORDER_ID) => subscribe(updates.forOrder(orderId));
  const listenAll = () => subscribe(updates.forAll());

  it('forwards the events of the order as "order" notices', () => {
    listen();

    events.next(message());
    events.next(
      message({
        messageId: '8c1f2d2e-3b68-4e8f-8d4a-1f7a5b1c7b22',
        type: 'order.picking-started',
        occurredAt: new Date('2026-09-17T12:00:05.000Z'),
      }),
    );

    expect(received).toEqual([
      {
        type: 'order',
        data: {
          orderId: ORDER_ID,
          eventType: 'order.payment-approved',
          messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
          occurredAt: '2026-09-17T12:00:03.000Z',
        },
      },
      {
        type: 'order',
        data: {
          orderId: ORDER_ID,
          eventType: 'order.picking-started',
          messageId: '8c1f2d2e-3b68-4e8f-8d4a-1f7a5b1c7b22',
          occurredAt: '2026-09-17T12:00:05.000Z',
        },
      },
    ]);
  });

  it('ignores the events of another order and of other aggregates', () => {
    listen();

    events.next(message({ payload: { aggregateType: 'Order', aggregateId: OTHER_ORDER_ID } }));
    events.next(message({ payload: { aggregateType: 'Customer', aggregateId: ORDER_ID } }));
    events.next(message({ payload: {} }));

    expect(received).toEqual([]);
  });

  it('never sends the payload nor the metadata of the event', () => {
    listen();

    events.next(message());

    const [notice] = received;
    expect(Object.keys(notice.data as object).sort()).toEqual([
      'eventType',
      'messageId',
      'occurredAt',
      'orderId',
    ]);
    expect(JSON.stringify(notice)).not.toContain('customerId');
    expect(JSON.stringify(notice)).not.toContain('chain-1');
  });

  it('sends a ping on every heartbeat interval', () => {
    listen();

    vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS - 1);
    expect(received).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(received).toEqual([{ type: 'ping', data: {} }]);

    vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS);
    expect(received).toHaveLength(2);
    expect(ORDER_STREAM_HEARTBEAT_MS).toBe(20_000);
  });

  it('completes, stopping the heartbeat, when the feed completes', () => {
    listen();

    events.complete();
    vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS * 2);

    expect(completed).toBe(true);
    expect(received).toEqual([]);
  });

  it('stops the heartbeat when the subscriber leaves', () => {
    const subscription = listen();

    subscription.unsubscribe();
    vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS * 2);

    expect(received).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('forAll', () => {
    it('forwards the events of every order as "order" notices', () => {
      listenAll();

      events.next(message());
      events.next(
        message({
          messageId: '9d2a3e3f-4c79-4f90-9e5b-2a8b6c2d8c33',
          type: 'order.placed',
          payload: { aggregateType: 'Order', aggregateId: OTHER_ORDER_ID, status: 'PLACED' },
          occurredAt: new Date('2026-09-17T12:00:04.000Z'),
        }),
      );

      expect(received).toEqual([
        {
          type: 'order',
          data: {
            orderId: ORDER_ID,
            eventType: 'order.payment-approved',
            messageId: '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11',
            occurredAt: '2026-09-17T12:00:03.000Z',
          },
        },
        {
          type: 'order',
          data: {
            orderId: OTHER_ORDER_ID,
            eventType: 'order.placed',
            messageId: '9d2a3e3f-4c79-4f90-9e5b-2a8b6c2d8c33',
            occurredAt: '2026-09-17T12:00:04.000Z',
          },
        },
      ]);
    });

    it('ignores the events of other aggregates and events without the order id', () => {
      listenAll();

      events.next(message({ payload: { aggregateType: 'Customer', aggregateId: ORDER_ID } }));
      events.next(message({ payload: { aggregateType: 'Order' } }));
      events.next(message({ payload: {} }));

      expect(received).toEqual([]);
    });

    it('never sends the payload nor the metadata of the event', () => {
      listenAll();

      events.next(message());

      const [notice] = received;
      expect(Object.keys(notice.data as object).sort()).toEqual([
        'eventType',
        'messageId',
        'occurredAt',
        'orderId',
      ]);
      expect(JSON.stringify(notice)).not.toContain('customerId');
      expect(JSON.stringify(notice)).not.toContain('chain-1');
    });

    it('sends a ping on every heartbeat interval', () => {
      listenAll();

      vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS);
      expect(received).toEqual([{ type: 'ping', data: {} }]);

      vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS);
      expect(received).toHaveLength(2);
    });

    it('completes, stopping the heartbeat, when the feed completes', () => {
      listenAll();

      events.complete();
      vi.advanceTimersByTime(ORDER_STREAM_HEARTBEAT_MS * 2);

      expect(completed).toBe(true);
      expect(received).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
