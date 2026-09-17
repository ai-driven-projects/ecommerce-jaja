// Integer setting read from the environment. A missing, non-integer or
// out-of-range value falls back to the default (it is not clamped to the
// nearest limit). Shared by the outbox relay and the consumers.
export function readInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return fallback;

  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
