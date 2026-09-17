import { describe, expect, it } from 'vitest';
import { nextAttemptAt } from '../../../src/messaging/outbox/outbox-backoff.js';

const NOW = new Date('2026-09-14T12:00:00.000Z');

function delayAfter(attempts: number): number {
  return nextAttemptAt(attempts, NOW).getTime() - NOW.getTime();
}

describe('nextAttemptAt', () => {
  it('waits 1 s, 2 s and 4 s after the 1st, 2nd and 3rd failures', () => {
    expect(delayAfter(1)).toBe(1_000);
    expect(delayAfter(2)).toBe(2_000);
    expect(delayAfter(3)).toBe(4_000);
  });

  it('caps the wait at 60 s from the 7th failure on', () => {
    expect(delayAfter(6)).toBe(32_000);
    expect(delayAfter(7)).toBe(60_000);
    expect(delayAfter(10)).toBe(60_000);
    expect(delayAfter(5_000)).toBe(60_000);
  });

  it('does not change the given date', () => {
    const now = new Date(NOW);
    nextAttemptAt(3, now);
    expect(now).toEqual(NOW);
  });
});
