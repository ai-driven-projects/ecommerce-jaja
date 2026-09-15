// Error codes of the messaging infrastructure (outbox and broker adapter).
export const MessagingErrors = {
  // `append` was called without the transaction of the aggregate: outside it the
  // outbox loses the guarantee of "event stored if and only if the aggregate is".
  MESSAGING_TRANSACTION_REQUIRED: 'MESSAGING_TRANSACTION_REQUIRED',
  // No connection to the broker (stopped, unreachable or refused the login).
  MESSAGE_BROKER_UNAVAILABLE: 'MESSAGE_BROKER_UNAVAILABLE',
  // Connected, but the broker rejected the message (nack) or the publication failed.
  MESSAGE_PUBLISH_FAILED: 'MESSAGE_PUBLISH_FAILED',
} as const;
