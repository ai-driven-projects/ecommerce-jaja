// Error codes of the messaging infrastructure (outbox, consumers and broker adapters).
export const MessagingErrors = {
  // `append` was called without the transaction of the aggregate: outside it the
  // outbox loses the guarantee of "event stored if and only if the aggregate is".
  MESSAGING_TRANSACTION_REQUIRED: 'MESSAGING_TRANSACTION_REQUIRED',
  // No connection to the broker (stopped, unreachable or refused the login).
  MESSAGE_BROKER_UNAVAILABLE: 'MESSAGE_BROKER_UNAVAILABLE',
  // Connected, but the broker rejected the message (nack) or the publication failed.
  MESSAGE_PUBLISH_FAILED: 'MESSAGE_PUBLISH_FAILED',
  // The body received from the broker is not a valid message (JSON with a uuid
  // `messageId`, a `type`, object `payload`/`metadata` and an ISO `occurredAt`).
  MESSAGE_INVALID: 'MESSAGE_INVALID',
  // Subscription with an empty queue, without routing keys or to a queue that is
  // already subscribed.
  MESSAGE_SUBSCRIPTION_INVALID: 'MESSAGE_SUBSCRIPTION_INVALID',
  // Consumer registered with an invalid name, event type or initial delay.
  EVENT_CONSUMER_INVALID: 'EVENT_CONSUMER_INVALID',
  // Two consumers registered with the same name (the name is the queue and the
  // idempotency key, so it must be unique).
  EVENT_CONSUMER_DUPLICATED: 'EVENT_CONSUMER_DUPLICATED',
} as const;
