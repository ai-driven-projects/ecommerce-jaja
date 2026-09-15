// Readable text of any thrown value, for logs and failures. Some errors have an
// empty `message`: `AggregateError` keeps the reasons in `errors` (e.g. `localhost`
// refused on both 127.0.0.1 and ::1 while Postgres or RabbitMQ is still starting),
// so logging only `error.message` would print nothing.
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.message.trim()) return error.message;

  const { errors, cause, code } = error as Error & { errors?: unknown; code?: unknown };
  if (Array.isArray(errors)) {
    const reasons = errors.map(errorMessage).filter(Boolean);
    if (reasons.length) return reasons.join('; ');
  }
  if (cause !== undefined) {
    const reason = errorMessage(cause);
    if (reason) return reason;
  }
  return typeof code === 'string' && code ? `${error.name} (${code})` : error.name;
}
