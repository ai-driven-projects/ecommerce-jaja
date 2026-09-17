import type { BrokerMessage, Result, TransactionManager } from '@mentoria-360/shared';

/**
 * Consumer of one event type, registered in `EventConsumerRegistry` and run by
 * `EventConsumerRunner`. The infrastructure takes care of idempotency, of the
 * transaction, of the causation of the new events, of the retries and of the
 * discard: the handler only calls a use case and returns its `Result`.
 *
 * It replaces the `EventConsumer` of the shared package inside the backend
 * because the handler needs the transaction of the consumer.
 */
export interface TransactionalEventConsumer {
  /**
   * Stable name in the `<module>.<action>` format, in kebab-case
   * (`^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$`, e.g. `orders.approve-payment`).
   * It names the queue (`jaja.<name>`) and is the key of the "processed" mark.
   *
   * Changing the name creates another queue (the old one keeps what it holds)
   * and loses the idempotency history: messages already processed under the old
   * name would be processed again.
   */
  readonly name: string;

  /** Type of the subscribed event (e.g. `order.placed`), equal to the routing key. */
  readonly eventType: string;

  /**
   * Wait before the first attempt of each message, in ms (integer from 0 to
   * 300 000; default 0). The wait happens in the broker, once per message.
   */
  readonly delayMs?: number;

  /**
   * Processes one message. The received `transactionManager` reuses the
   * transaction of the consumer (where the message was already marked as
   * processed) and must be passed to the use case, so its writes and events
   * are committed or rolled back together with the mark.
   *
   * A failed `Result` or an exception rolls everything back and schedules a new
   * attempt. Messages may arrive out of order: a message that no longer applies
   * to the current state of the aggregate must end with `Result.ok()` (logging
   * the reason) instead of failing.
   */
  handle(message: BrokerMessage, transactionManager: TransactionManager): Promise<Result<void>>;
}
