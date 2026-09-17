import { Result } from '@mentoria-360/shared';
import type { BrokerMessage } from '@mentoria-360/shared';
import { MessagingErrors } from '../messaging-errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 date and time, as written by `Date.toISOString` (offset optional).
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

// Turns the body received from the broker into a `BrokerMessage`, the format
// written by the publisher: JSON with `messageId` (uuid, the id of the event,
// also the key of `processed_messages`), `type` (non-empty text), `payload` and
// `metadata` (objects; a missing `metadata` becomes `{}`) and `occurredAt` (ISO
// 8601 date, converted to `Date`). Anything else, invalid JSON included, fails
// with `MESSAGE_INVALID`: such a message would never succeed.
export function parseBrokerMessage(content: Buffer): Result<BrokerMessage> {
  let body: unknown;
  try {
    body = JSON.parse(content.toString('utf8'));
  } catch {
    return Result.fail(MessagingErrors.MESSAGE_INVALID);
  }
  if (!isRecord(body)) return Result.fail(MessagingErrors.MESSAGE_INVALID);

  const { messageId, type, payload, metadata = {}, occurredAt } = body;
  if (typeof messageId !== 'string' || !UUID_PATTERN.test(messageId)) {
    return Result.fail(MessagingErrors.MESSAGE_INVALID);
  }
  if (typeof type !== 'string' || !type.trim()) return Result.fail(MessagingErrors.MESSAGE_INVALID);
  if (!isRecord(payload) || !isRecord(metadata))
    return Result.fail(MessagingErrors.MESSAGE_INVALID);

  const date = parseIsoDate(occurredAt);
  if (!date) return Result.fail(MessagingErrors.MESSAGE_INVALID);

  return Result.ok({ messageId, type, payload, metadata, occurredAt: date });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_DATE_TIME_PATTERN.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
