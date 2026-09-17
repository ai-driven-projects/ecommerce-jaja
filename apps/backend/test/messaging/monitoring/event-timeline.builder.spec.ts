import { describe, expect, it } from 'vitest';
import { buildEventTimeline } from '../../../src/messaging/monitoring/event-timeline.builder.js';
import type {
  EventTimelineEventRow,
  EventTimelineMarkRow,
  EventTimelineRegisteredConsumer,
} from '../../../src/messaging/monitoring/event-timeline.types.js';

const PLACED_ID = '0a4ca9ca-80d0-4b6d-9dac-0e5874dc8ec4';
const APPROVED_ID = '7b0f1c1e-2a57-4d7e-9c3f-0e6f4a0b6a11';
const PICKING_ID = '8c1f2d2e-3b68-4e8f-8d4a-1f7a5b1c7b22';

function event(overrides: Partial<EventTimelineEventRow> = {}): EventTimelineEventRow {
  return {
    id: PLACED_ID,
    type: 'order.placed',
    occurredAt: new Date('2026-09-17T12:00:00.000Z'),
    payload: { aggregateType: 'Order', status: 'PLACED' },
    metadata: {},
    status: 'PUBLISHED',
    attempts: 0,
    availableAt: new Date('2026-09-17T12:00:00.000Z'),
    publishedAt: new Date('2026-09-17T12:00:00.500Z'),
    lastError: null,
    ...overrides,
  };
}

function mark(overrides: Partial<EventTimelineMarkRow> = {}): EventTimelineMarkRow {
  return {
    consumer: 'payment.approve-order',
    messageId: PLACED_ID,
    processedAt: new Date('2026-09-17T12:00:03.600Z'),
    ...overrides,
  };
}

const CONSUMERS: EventTimelineRegisteredConsumer[] = [
  { name: 'payment.approve-order', eventType: 'order.placed', delayMs: 3_000 },
  { name: 'store.start-picking', eventType: 'order.payment-approved', delayMs: 2_000 },
];

describe('buildEventTimeline', () => {
  it('orders the events by occurredAt and then by id', () => {
    const sameInstant = new Date('2026-09-17T12:00:05.000Z');
    const timeline = buildEventTimeline(
      [
        event({ id: PICKING_ID, type: 'order.picking-started', occurredAt: sameInstant }),
        event({ id: APPROVED_ID, type: 'order.payment-approved', occurredAt: sameInstant }),
        event(),
      ],
      [],
      [],
    );

    expect(timeline.map((entry) => entry.id)).toEqual([PLACED_ID, APPROVED_ID, PICKING_ID]);
  });

  it('reads causationId and correlationId from the metadata, or null', () => {
    const [first, second, third] = buildEventTimeline(
      [
        event(),
        event({
          id: APPROVED_ID,
          type: 'order.payment-approved',
          occurredAt: new Date('2026-09-17T12:00:04.000Z'),
          metadata: { causationId: PLACED_ID, correlationId: PLACED_ID, extra: 1 },
        }),
        event({
          id: PICKING_ID,
          type: 'order.picking-started',
          occurredAt: new Date('2026-09-17T12:00:06.000Z'),
          metadata: { causationId: 42, correlationId: '' },
        }),
      ],
      [],
      [],
    );

    expect([first.causationId, first.correlationId]).toEqual([null, null]);
    expect([second.causationId, second.correlationId]).toEqual([PLACED_ID, PLACED_ID]);
    expect(second.metadata).toEqual({ causationId: PLACED_ID, correlationId: PLACED_ID, extra: 1 });
    expect([third.causationId, third.correlationId]).toEqual([null, null]);
  });

  it('copies the id, type, payload and the outbox situation of the event', () => {
    const [entry] = buildEventTimeline(
      [event({ status: 'PENDING', attempts: 2, publishedAt: null, lastError: 'broker down' })],
      [],
      [],
    );

    expect(entry).toMatchObject({
      id: PLACED_ID,
      type: 'order.placed',
      occurredAt: new Date('2026-09-17T12:00:00.000Z'),
      payload: { aggregateType: 'Order', status: 'PLACED' },
      outbox: {
        status: 'PENDING',
        attempts: 2,
        availableAt: new Date('2026-09-17T12:00:00.000Z'),
        publishedAt: null,
        lastError: 'broker down',
      },
    });
  });

  it('marks a consumer with the mark as processed', () => {
    const [entry] = buildEventTimeline([event()], [mark()], CONSUMERS);

    expect(entry.consumers).toEqual([
      {
        name: 'payment.approve-order',
        delayMs: 3_000,
        registered: true,
        processedAt: new Date('2026-09-17T12:00:03.600Z'),
        expectedAt: new Date('2026-09-17T12:00:03.500Z'),
        state: 'processed',
      },
    ]);
  });

  it('marks a consumer of a published event without the mark as waiting, with expectedAt', () => {
    const [entry] = buildEventTimeline([event()], [], CONSUMERS);

    expect(entry.consumers).toEqual([
      {
        name: 'payment.approve-order',
        delayMs: 3_000,
        registered: true,
        processedAt: null,
        expectedAt: new Date('2026-09-17T12:00:03.500Z'),
        state: 'waiting',
      },
    ]);
  });

  it('marks the consumers of an event still in the outbox as event-pending', () => {
    const [entry] = buildEventTimeline(
      [event({ status: 'PENDING', publishedAt: null })],
      [],
      CONSUMERS,
    );

    expect(entry.consumers).toEqual([
      {
        name: 'payment.approve-order',
        delayMs: 3_000,
        registered: true,
        processedAt: null,
        expectedAt: null,
        state: 'event-pending',
      },
    ]);
  });

  it('leaves expectedAt null for a registered consumer without delayMs', () => {
    const [entry] = buildEventTimeline(
      [event()],
      [],
      [{ name: 'payment.approve-order', eventType: 'order.placed' }],
    );

    expect(entry.consumers[0]).toMatchObject({
      delayMs: null,
      registered: true,
      expectedAt: null,
      state: 'waiting',
    });
  });

  it('adds the consumers that processed the event without being registered', () => {
    const [entry] = buildEventTimeline(
      [event()],
      [
        mark({ consumer: 'audit.record-order', processedAt: new Date('2026-09-17T12:00:02.000Z') }),
        mark(),
        mark({ consumer: 'other.event', messageId: APPROVED_ID }),
      ],
      [],
    );

    expect(entry.consumers).toEqual([
      {
        name: 'audit.record-order',
        delayMs: null,
        registered: false,
        processedAt: new Date('2026-09-17T12:00:02.000Z'),
        expectedAt: null,
        state: 'processed',
      },
      {
        name: 'payment.approve-order',
        delayMs: null,
        registered: false,
        processedAt: new Date('2026-09-17T12:00:03.600Z'),
        expectedAt: null,
        state: 'processed',
      },
    ]);
  });

  it('keeps an event without consumers with an empty list', () => {
    const [entry] = buildEventTimeline(
      [event({ type: 'order.delivered' })],
      [mark({ messageId: APPROVED_ID })],
      CONSUMERS,
    );

    expect(entry.consumers).toEqual([]);
  });

  it('lists the registered consumers in the order of registration, before the unregistered', () => {
    const consumers: EventTimelineRegisteredConsumer[] = [
      { name: 'zeta.notify', eventType: 'order.placed', delayMs: 0 },
      { name: 'alpha.approve', eventType: 'order.placed', delayMs: 1_000 },
    ];

    const [entry] = buildEventTimeline(
      [event()],
      [mark({ consumer: 'alpha.approve' }), mark({ consumer: 'beta.legacy' })],
      consumers,
    );

    expect(entry.consumers.map(({ name, registered, state }) => [name, registered, state])).toEqual([
      ['zeta.notify', true, 'waiting'],
      ['alpha.approve', true, 'processed'],
      ['beta.legacy', false, 'processed'],
    ]);
  });

  it('returns an empty timeline without events', () => {
    expect(buildEventTimeline([], [mark()], CONSUMERS)).toEqual([]);
  });
});
