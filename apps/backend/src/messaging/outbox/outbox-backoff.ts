import { backoffDelayMs } from '../backoff.js';

// When an event may be published again after its failure number `attempts`:
// 2^(attempts - 1) seconds later (1 s, 2 s, 4 s...), never more than 60 s.
export function nextAttemptAt(attempts: number, now: Date): Date {
  return new Date(now.getTime() + backoffDelayMs(attempts));
}
