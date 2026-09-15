const SECOND_MS = 1_000;
const MAX_DELAY_MS = 60 * SECOND_MS;

// When an event may be published again after its failure number `attempts`:
// 2^(attempts - 1) seconds later (1 s, 2 s, 4 s...), never more than 60 s.
export function nextAttemptAt(attempts: number, now: Date): Date {
  const exponent = Math.max(Math.trunc(attempts), 1) - 1;
  const delayMs = Math.min(2 ** exponent * SECOND_MS, MAX_DELAY_MS);
  return new Date(now.getTime() + delayMs);
}
