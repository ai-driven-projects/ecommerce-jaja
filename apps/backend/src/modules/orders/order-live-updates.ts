import { Injectable, MessageEvent } from '@nestjs/common';
import type { BrokerMessage } from '@mentoria-360/shared';
import { endWith, filter, ignoreElements, interval, map, merge, Observable, takeUntil } from 'rxjs';
import { LiveEventFeed } from '../../messaging/live/live-event-feed.js';

// Interval of the heartbeat of the order streams: keeps proxies and the browser
// from closing an idle connection.
export const ORDER_STREAM_HEARTBEAT_MS = 20_000;

const ORDER_AGGREGATE_TYPE = 'Order';

// Data of a notice: which event of which order, never the order nor the payload.
export interface OrderStreamNotice {
  orderId: string;
  eventType: string;
  messageId: string;
  // ISO 8601.
  occurredAt: string;
}

/**
 * Live notices of the orders, built on `LiveEventFeed` (the copy of every event
 * received by this instance). A notice only says that something happened to the
 * order: the page reads the order again through the REST API, the source of the
 * truth, so a lost notice never leaves the screen wrong for long.
 */
@Injectable()
export class OrderLiveUpdates {
  constructor(private readonly feed: LiveEventFeed) {}

  /**
   * Events of one order as SSE messages:
   * - `{ type: 'order', data: { orderId, eventType, messageId, occurredAt } }`
   *   for each event whose payload has `aggregateType` `Order` and
   *   `aggregateId` equal to `orderId` (the other orders and aggregates are
   *   ignored);
   * - `{ type: 'ping', data: {} }` every `ORDER_STREAM_HEARTBEAT_MS`.
   *
   * Completes when the feed completes (the backend is shutting down), so the
   * open streams end with it.
   */
  forOrder(orderId: string): Observable<MessageEvent> {
    return this.noticesOf((message) => orderIdOf(message) === orderId);
  }

  /**
   * Events of **every** order as SSE messages, for the admin stream: the same
   * `order` notices of `forOrder` (with the `orderId` of each event), the same
   * `ping` and the same end with the feed. Events of other aggregates are
   * ignored.
   */
  forAll(): Observable<MessageEvent> {
    return this.noticesOf((message) => orderIdOf(message) !== null);
  }

  // The notices of the events accepted by `accepts`, merged with the heartbeat,
  // which stops when the feed completes.
  private noticesOf(accepts: (message: BrokerMessage) => boolean): Observable<MessageEvent> {
    const notices = this.feed.events$.pipe(
      filter(accepts),
      map((message): MessageEvent => ({ type: 'order', data: toNotice(message) })),
    );

    const feedEnded = this.feed.events$.pipe(ignoreElements(), endWith(true));
    const heartbeat = interval(ORDER_STREAM_HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
      takeUntil(feedEnded),
    );

    return merge(notices, heartbeat);
  }
}

// The order id of an event of the `Order` aggregate (`payload.aggregateId`), or
// `null` for events of other aggregates and events without the id.
function orderIdOf(message: BrokerMessage): string | null {
  const payload = message.payload ?? {};
  if (payload.aggregateType !== ORDER_AGGREGATE_TYPE) return null;
  return typeof payload.aggregateId === 'string' && payload.aggregateId ? payload.aggregateId : null;
}

// Only called for messages accepted by `orderIdOf`.
function toNotice(message: BrokerMessage): OrderStreamNotice {
  return {
    orderId: orderIdOf(message) ?? '',
    eventType: message.type,
    messageId: message.messageId,
    occurredAt: message.occurredAt.toISOString(),
  };
}
