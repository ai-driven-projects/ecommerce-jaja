import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEvent, MessagePublisher, Result } from '@mentoria-360/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxRelay } from '../../../src/messaging/outbox/outbox-relay.js';
import { OutboxBatchResult, OutboxPrisma, PublishBatch } from '../../../src/messaging/outbox/outbox.prisma.js';

const LOG_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;

const EVENTS: DomainEvent[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'customer.registered',
    aggregateType: 'Customer',
    aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d',
    payload: { email: 'cliente@exemplo.com' },
    metadata: { ip: '10.0.0.1' },
    occurredAt: new Date('2026-09-14T12:00:00.000Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    type: 'customer.verified',
    aggregateType: 'Customer',
    aggregateId: 'c7b8a3d2-5e4f-4a1b-8c9d-0e1f2a3b4c5d',
    payload: { email: 'cliente@exemplo.com' },
    metadata: {},
    occurredAt: new Date('2026-09-14T12:00:01.000Z'),
  },
];

type ProcessPendingBatch = (limit: number, publish: PublishBatch) => Promise<OutboxBatchResult>;

// Hands the events to the relay callback and counts like `OutboxPrisma` does.
function batchOf(events: DomainEvent[]): ProcessPendingBatch {
  return async (_limit, publish) => {
    const { publishedIds, failure } = await publish(events);
    return { published: publishedIds.length, failed: failure ? 1 : 0 };
  };
}

function createRelay(env: Record<string, string | undefined> = {}) {
  const processPendingBatch = vi.fn<ProcessPendingBatch>(async () => ({ published: 0, failed: 0 }));
  const publish = vi.fn<MessagePublisher['publish']>(async () => Result.ok());
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const relay = new OutboxRelay(
    { processPendingBatch } as unknown as OutboxPrisma,
    { publish },
    config,
  );
  return { relay, processPendingBatch, publish };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('OutboxRelay', () => {
  let logged: { level: string; text: string }[];

  beforeEach(() => {
    vi.useFakeTimers();
    logged = [];
    for (const level of LOG_LEVELS) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => {
        logged.push({ level, text: args.map((arg) => String(arg)).join(' ') });
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runOnce passes the batch size and returns the counts', async () => {
    const { relay, processPendingBatch, publish } = createRelay({ OUTBOX_BATCH_SIZE: '10' });
    processPendingBatch.mockImplementation(batchOf(EVENTS));

    const result = await relay.runOnce();

    expect(result).toEqual({ published: 2, failed: 0 });
    expect(processPendingBatch).toHaveBeenCalledWith(10, expect.any(Function));
    expect(publish).toHaveBeenCalledTimes(2);
    expect(logged).toContainEqual({ level: 'log', text: '2 evento(s) publicado(s)' });
  });

  it('logs nothing when a cycle finds no pending events', async () => {
    const { relay } = createRelay();

    expect(await relay.runOnce()).toEqual({ published: 0, failed: 0 });
    expect(logged).toEqual([]);
  });

  it('processes a single batch when two runOnce calls overlap', async () => {
    const { relay, processPendingBatch } = createRelay();
    const batch = deferred<OutboxBatchResult>();
    processPendingBatch.mockImplementation(() => batch.promise);

    const first = relay.runOnce();
    const second = relay.runOnce();

    expect(await second).toEqual({ published: 0, failed: 0 });
    batch.resolve({ published: 3, failed: 0 });
    expect(await first).toEqual({ published: 3, failed: 0 });
    expect(processPendingBatch).toHaveBeenCalledTimes(1);

    // Once the cycle ends, the next one runs again.
    await relay.runOnce();
    expect(processPendingBatch).toHaveBeenCalledTimes(2);
  });

  it('schedules no interval with OUTBOX_RELAY_ENABLED=false', async () => {
    const { relay, processPendingBatch } = createRelay({ OUTBOX_RELAY_ENABLED: 'false' });

    relay.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(processPendingBatch).not.toHaveBeenCalled();
  });

  it('starts the interval once and logs interval and batch size', async () => {
    const { relay, processPendingBatch } = createRelay({
      OUTBOX_POLL_INTERVAL_MS: '250',
      OUTBOX_BATCH_SIZE: '500',
      OUTBOX_RELAY_ENABLED: 'true',
    });

    relay.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(750);

    expect(processPendingBatch).toHaveBeenCalledTimes(3);
    expect(processPendingBatch).toHaveBeenCalledWith(500, expect.any(Function));
    const started = logged.filter((line) => line.text.includes('Outbox relay started'));
    expect(started).toHaveLength(1);
    expect(started[0].text).toContain('250 ms');
    expect(started[0].text).toContain('500 events');
  });

  it.each([
    { interval: '50', batch: 'abc' },
    { interval: 'fast', batch: '0' },
    { interval: '1.5', batch: '501' },
    { interval: '', batch: '-3' },
  ])(
    'falls back to 1000 ms and 50 events with interval "$interval" and batch "$batch"',
    async ({ interval, batch }) => {
      const { relay, processPendingBatch } = createRelay({
        OUTBOX_POLL_INTERVAL_MS: interval,
        OUTBOX_BATCH_SIZE: batch,
      });

      relay.onApplicationBootstrap();
      await vi.advanceTimersByTimeAsync(999);
      expect(processPendingBatch).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(processPendingBatch).toHaveBeenCalledTimes(1);
      expect(processPendingBatch).toHaveBeenCalledWith(50, expect.any(Function));
      await relay.onModuleDestroy();
    },
  );

  it('logs an exception of OutboxPrisma and runs the next cycle', async () => {
    const { relay, processPendingBatch } = createRelay();
    processPendingBatch
      .mockRejectedValueOnce(new Error('Transaction already closed'))
      .mockResolvedValue({ published: 0, failed: 0 });

    relay.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(logged).toContainEqual({
      level: 'error',
      text: 'Outbox relay cycle failed: Transaction already closed',
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(processPendingBatch).toHaveBeenCalledTimes(2);
    await relay.onModuleDestroy();
  });

  it('logs the reasons of an error without message, like a refused database connection', async () => {
    const { relay, processPendingBatch } = createRelay();
    processPendingBatch.mockRejectedValueOnce(
      new AggregateError(
        [new Error('connect ECONNREFUSED 127.0.0.1:5433'), new Error('connect ECONNREFUSED ::1:5433')],
        '',
      ),
    );

    await relay.runOnce();

    expect(logged).toContainEqual({
      level: 'error',
      text: 'Outbox relay cycle failed: connect ECONNREFUSED 127.0.0.1:5433; connect ECONNREFUSED ::1:5433',
    });
  });

  it('warns with id, type and error of the failed event, never the payload', async () => {
    const { relay, processPendingBatch, publish } = createRelay();
    processPendingBatch.mockImplementation(batchOf(EVENTS));
    publish.mockResolvedValueOnce(Result.ok()).mockResolvedValueOnce(
      Result.fail('MESSAGE_BROKER_UNAVAILABLE'),
    );

    const result = await relay.runOnce();

    expect(result).toEqual({ published: 1, failed: 1 });
    const warning = logged.find((line) => line.level === 'warn');
    expect(warning?.text).toContain(EVENTS[1].id);
    expect(warning?.text).toContain('customer.verified');
    expect(warning?.text).toContain('MESSAGE_BROKER_UNAVAILABLE');
    expect(logged.some((line) => line.text.includes('cliente@exemplo.com'))).toBe(false);
    expect(logged.some((line) => line.text.includes('10.0.0.1'))).toBe(false);
  });

  it('onModuleDestroy cancels the interval and waits for the running cycle', async () => {
    const { relay, processPendingBatch } = createRelay();
    const batch = deferred<OutboxBatchResult>();
    processPendingBatch.mockImplementationOnce(() => batch.promise);

    relay.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(processPendingBatch).toHaveBeenCalledTimes(1);

    let destroyed = false;
    const destroying = relay.onModuleDestroy().then(() => {
      destroyed = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(destroyed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    batch.resolve({ published: 0, failed: 0 });
    await destroying;
    expect(destroyed).toBe(true);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(processPendingBatch).toHaveBeenCalledTimes(1);
  });
});
