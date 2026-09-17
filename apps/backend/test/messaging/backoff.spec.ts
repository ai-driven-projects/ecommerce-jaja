import { describe, expect, it } from 'vitest';
import { backoffDelayMs } from '../../src/messaging/backoff.js';

describe('backoffDelayMs', () => {
  it('waits 1 s, 2 s and 4 s after the 1st, 2nd and 3rd failures', () => {
    expect(backoffDelayMs(1)).toBe(1_000);
    expect(backoffDelayMs(2)).toBe(2_000);
    expect(backoffDelayMs(3)).toBe(4_000);
  });

  it('caps the wait at 60 s from the 7th failure on', () => {
    expect(backoffDelayMs(6)).toBe(32_000);
    expect(backoffDelayMs(7)).toBe(60_000);
    expect(backoffDelayMs(10)).toBe(60_000);
    expect(backoffDelayMs(5_000)).toBe(60_000);
  });

  it('treats zero, negative and fractional attempts as the first failure', () => {
    expect(backoffDelayMs(0)).toBe(1_000);
    expect(backoffDelayMs(-3)).toBe(1_000);
    expect(backoffDelayMs(1.9)).toBe(1_000);
  });
});
