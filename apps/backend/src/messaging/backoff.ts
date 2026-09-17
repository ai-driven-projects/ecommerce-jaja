const SECOND_MS = 1_000;
const MAX_DELAY_MS = 60 * SECOND_MS;

// Wait after the failure number `attempts`: 2^(attempts - 1) seconds (1 s, 2 s,
// 4 s...), never more than 60 s. Shared by the outbox relay (next publication)
// and by the consumers (next attempt of a message and reconnection to the broker).
export function backoffDelayMs(attempts: number): number {
  const exponent = Math.max(Math.trunc(attempts), 1) - 1;
  return Math.min(2 ** exponent * SECOND_MS, MAX_DELAY_MS);
}
