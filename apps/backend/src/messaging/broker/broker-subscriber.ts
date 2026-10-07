import type { BrokerMessage, Result } from '@mentoria-360/shared';

export const BROKER_SUBSCRIBER = Symbol('BROKER_SUBSCRIBER');

/**
 * How the messages of a subscription are split between the backend instances:
 * - `work`: one queue shared by every instance (each message goes to **one** of
 *   them), durable, with the initial wait, the retries and the discard. Used by
 *   the business consumers;
 * - `broadcast`: each instance gets **its own copy** of every message, with no
 *   delivery guarantee (no retries, no discard, messages published while the
 *   instance is disconnected are lost). Used for live notices.
 */
export type BrokerSubscriptionMode = 'work' | 'broadcast';

/**
 * Subscription in the terms of the backend, independent of the broker. The
 * adapter turns it into its own topology: the physical name of the queue, the
 * binding of the event types, the retry and the discard.
 */
export interface BrokerSubscription {
  /**
   * Logical name, in kebab-case segments separated by `.` (e.g.
   * `orders.approve-payment`, `live`). Unique per adapter. The adapter derives
   * the physical queue from it, so the same name always reaches the same queue
   * (in `work` mode) and the history of a consumer is kept.
   */
  readonly name: string;

  /** Subscribed event types (the `type` of the message). Empty: every event. */
  readonly eventTypes: readonly string[];

  /** Default `work`. */
  readonly mode?: BrokerSubscriptionMode;

  /**
   * Wait before the first attempt of each message, in ms (integer, default 0).
   * Only in `work` mode: a `broadcast` subscription with a wait is invalid.
   */
  readonly delayMs?: number;

  /**
   * Processes one message. In `work` mode a failed `Result` or an exception
   * schedules a new attempt; in `broadcast` mode it only goes to the log.
   */
  readonly onMessage: (message: BrokerMessage) => Promise<Result<void>>;
}

/**
 * Consumption port of the backend. It replaces the `MessageConsumer` of the
 * shared package inside the backend because the subscriptions need the initial
 * wait and the `broadcast` mode, which the shared port does not have. Each
 * broker has its own adapter (today, `rabbitmq/`), and nothing outside the
 * adapter knows queue names, routing keys or wildcards.
 *
 * `subscribe` validates and stores the subscription and returns without
 * waiting for the broker. An invalid subscription (bad name, blank event type,
 * invalid wait, `broadcast` with a wait) or a name already subscribed fails
 * with `MESSAGE_SUBSCRIPTION_INVALID`.
 */
export interface BrokerSubscriber {
  subscribe(subscription: BrokerSubscription): Promise<Result<void>>;
}
