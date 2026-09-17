import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Result } from '@mentoria-360/shared';
import type { ConsumeMessageIn, MessageConsumer } from '@mentoria-360/shared';
import amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import { backoffDelayMs } from '../backoff.js';
import { errorMessage } from '../error-message.util.js';
import { MessagingErrors } from '../messaging-errors.js';
import { parseBrokerMessage } from './broker-message.parser.js';
import { brokerAddress, redactCredentials } from './rabbitmq-url.util.js';

export interface RabbitMqConsumerConfig {
  // Carries user and password: never logged nor copied into an error message.
  readonly url: string;
  // Durable topic exchange of the events (the same of the publisher).
  readonly exchange: string;
  // Messages delivered and not yet confirmed at the same time, per subscription.
  readonly prefetch: number;
  // Attempts before the discard, counting the first one.
  readonly maxAttempts: number;
}

// Subscription accepted by this adapter: the port input plus the optional wait
// before the first attempt of each message (0 or missing: no wait) and the
// transient mode.
//
// Work queue (default): durable, shared by every instance of the backend (each
// message goes to **one** of them), with retries (`.wait`), discard (`.dead`)
// and the idempotency of the consumers. Used by the business consumers.
//
// Transient queue (`transient: true`): not durable, exclusive to the connection
// and deleted when it closes, so each instance has its own queue and receives
// **its own copy** of every message (broadcast). No wait, no retries, no discard:
// every delivery is confirmed, whatever the result. Used for live notices, which
// need no delivery guarantee.
export interface RabbitMqSubscription extends ConsumeMessageIn {
  readonly delayMs?: number;
  // A transient subscription with an initial wait (`delayMs` > 0) is invalid.
  readonly transient?: boolean;
}

// Control headers of the republished messages.
export const RabbitMqConsumerHeaders = {
  // Number of the next attempt (missing = 1).
  ATTEMPT: 'x-jaja-attempt',
  // The initial wait (`delayMs`) was already served.
  DELAYED: 'x-jaja-delayed',
  // Codes of the last failure, up to 500 characters.
  LAST_ERROR: 'x-jaja-last-error',
  // Why the message is in `<queue>.dead`.
  DEAD_REASON: 'x-jaja-dead-reason',
} as const;

export const RabbitMqDeadReasons = {
  MAX_ATTEMPTS_EXCEEDED: 'MAX_ATTEMPTS_EXCEEDED',
  MESSAGE_INVALID: MessagingErrors.MESSAGE_INVALID,
} as const;

// Same timeout of the publisher.
const CONNECT_TIMEOUT_MS = 5_000;
const LAST_ERROR_MAX_LENGTH = 500;
// The default exchange routes by queue name: a republished message goes only
// to the named queue, never through the events exchange.
const DEFAULT_EXCHANGE = '';

type Closable = { close(): Promise<void> };
type Headers = Record<string, unknown>;

interface ActiveSubscription {
  readonly channel: ConfirmChannel;
  consumerTag: string | null;
}

export function waitQueueOf(queue: string): string {
  return `${queue}.wait`;
}

export function deadQueueOf(queue: string): string {
  return `${queue}.dead`;
}

/**
 * RabbitMQ adapter of the `MessageConsumer` port, created by the factory of
 * `MessagingModule`.
 *
 * Connection: its own, separate from the publisher (the flow control that
 * blocks a publishing connection must not stop the consumption). It opens on the
 * first subscription without blocking it; while the broker is down a warning is
 * logged and a new attempt is scheduled with `backoffDelayMs` (no limit, one
 * attempt at a time). On `error`/`close` the connection is discarded and a
 * reconnection is scheduled; every subscription is set up again on connecting.
 *
 * Topology, per subscription and on its own confirm channel (so a channel error
 * brings down, and sets up again, only that subscription). A transient
 * subscription declares only `<queue>` (`durable: false`, `exclusive: true`,
 * `autoDelete: true`), bound to the exchange with each routing key; it is
 * declared again on every reconnection, and the messages published while the
 * connection was down are lost. A work subscription declares:
 * - `<queue>`: durable, bound to the exchange with each routing key;
 * - `<queue>.wait`: durable, without consumers, with `x-dead-letter-exchange: ''`
 *   and `x-dead-letter-routing-key: <queue>`: an expired message goes straight
 *   back to `<queue>`, so the other consumers of the event get no copy;
 * - `<queue>.dead`: durable, without arguments: discarded messages for inspection.
 *
 * The arguments of the queues are fixed in the code. RabbitMQ does not change
 * the arguments of an existing queue (the declaration fails with
 * `PRECONDITION_FAILED`), so changing them requires deleting the queues in the
 * panel first.
 *
 * The waits use a per-message TTL (`expiration`): a message only expires when
 * it reaches the head of `<queue>.wait`, so a long wait may delay a short one
 * that is behind it. Accepted here: retries wait at most 60 s and the initial
 * wait of a consumer is usually constant.
 */
export class RabbitMqMessageConsumer implements MessageConsumer, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqMessageConsumer.name);
  // `host:port` of the broker, the only identification that goes to the logs.
  private readonly address: string;
  private readonly subscriptions = new Map<string, RabbitMqSubscription>();
  private readonly active = new Map<string, ActiveSubscription>();
  private readonly resubscribeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly resubscribeAttempts = new Map<string, number>();
  private readonly setups = new Set<Promise<void>>();
  private readonly inFlight = new Set<Promise<void>>();
  private connection: ChannelModel | null = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private closed = false;

  constructor(private readonly config: RabbitMqConsumerConfig) {
    this.address = brokerAddress(config.url);
  }

  // Validates and stores the subscription, and returns without waiting for the
  // broker: the backend never waits for it to start.
  async subscribe(input: RabbitMqSubscription): Promise<Result<void>> {
    const queue = typeof input?.queue === 'string' ? input.queue.trim() : '';
    const routingKeys = Array.isArray(input?.routingKeys) ? input.routingKeys : [];
    const validKeys = routingKeys.every((key) => typeof key === 'string' && key.trim() !== '');
    const delayMs = input?.delayMs ?? 0;
    const transient = input?.transient === true;
    // A transient queue has no `.wait`, so it cannot serve an initial wait.
    const validDelay = Number.isInteger(delayMs) && delayMs >= 0 && !(transient && delayMs > 0);

    if (
      !queue ||
      !routingKeys.length ||
      !validKeys ||
      !validDelay ||
      typeof input.onMessage !== 'function' ||
      this.subscriptions.has(queue)
    ) {
      return Result.fail(MessagingErrors.MESSAGE_SUBSCRIPTION_INVALID);
    }

    this.subscriptions.set(queue, {
      ...input,
      queue,
      routingKeys: [...routingKeys],
      delayMs,
      transient,
    });
    if (this.connection) {
      this.startSetup(queue, this.connection);
    } else {
      this.ensureConnection();
    }
    return Result.ok();
  }

  // Stops scheduling reconnections, cancels the consumers (no new deliveries),
  // waits for the messages in processing and closes channels and connection.
  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    for (const timer of this.resubscribeTimers.values()) clearTimeout(timer);
    this.resubscribeTimers.clear();

    await this.connecting;
    await Promise.allSettled(this.setups);

    const active = [...this.active.values()];
    await Promise.allSettled(
      active.map(({ channel, consumerTag }) =>
        consumerTag ? channel.cancel(consumerTag) : Promise.resolve(),
      ),
    );
    await Promise.allSettled(this.inFlight);

    const { connection } = this;
    this.active.clear();
    this.connection = null;
    for (const { channel } of active) await closeQuietly(channel);
    if (connection) await closeQuietly(connection);
  }

  private ensureConnection(): void {
    if (this.closed || this.connection || this.connecting || this.reconnectTimer) return;

    this.connecting = this.connect().finally(() => {
      this.connecting = null;
    });
  }

  // Never rejects: a failure logs a warning and schedules the next attempt.
  private async connect(): Promise<void> {
    let connection: ChannelModel | null = null;
    try {
      connection = await amqp.connect(this.config.url, { timeout: CONNECT_TIMEOUT_MS });
    } catch (error: unknown) {
      if (this.closed) return;
      const delay = this.scheduleReconnect();
      this.logger.warn(
        `RabbitMQ unavailable at ${this.address} for consuming: ${this.describe(error)}. Retrying in ${delay} ms.`,
      );
      return;
    }

    if (this.closed) {
      await closeQuietly(connection);
      return;
    }

    const current = connection;
    // An `error` event without a listener would crash the process. amqplib
    // emits `close` after it; both discard the connection.
    current.on('error', (error: Error) => this.discard(current, this.describe(error)));
    current.on('close', () => this.discard(current, 'connection closed'));

    this.connection = current;
    this.reconnectAttempts = 0;
    this.logger.log(
      `Connected to RabbitMQ at ${this.address} for consuming (${this.subscriptions.size} subscription(s))`,
    );
    for (const queue of this.subscriptions.keys()) this.startSetup(queue, current);
  }

  // Returns the wait until the next attempt.
  private scheduleReconnect(): number {
    this.reconnectAttempts += 1;
    const delay = backoffDelayMs(this.reconnectAttempts);
    if (!this.closed && !this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.ensureConnection();
      }, delay);
    }
    return delay;
  }

  // Forgets the connection and its channels after `error`/`close` and schedules
  // the reconnection. Ignores events of connections already replaced.
  private discard(connection: ChannelModel, reason: string): void {
    if (this.connection !== connection) return;

    this.connection = null;
    this.active.clear();
    for (const timer of this.resubscribeTimers.values()) clearTimeout(timer);
    this.resubscribeTimers.clear();
    this.resubscribeAttempts.clear();
    void closeQuietly(connection);
    if (this.closed) return;

    const delay = this.scheduleReconnect();
    this.logger.warn(
      `RabbitMQ consuming connection to ${this.address} lost (${reason}); reconnecting in ${delay} ms.`,
    );
  }

  private startSetup(queue: string, connection: ChannelModel): void {
    const setup = this.setUp(queue, connection).finally(() => {
      this.setups.delete(setup);
    });
    this.setups.add(setup);
  }

  // Declares the topology of one subscription on its own confirm channel and
  // starts consuming. Never rejects: a failure schedules a new setup.
  private async setUp(queue: string, connection: ChannelModel): Promise<void> {
    const subscription = this.subscriptions.get(queue);
    if (!subscription || this.closed || this.connection !== connection || this.active.has(queue)) {
      return;
    }

    let channel: ConfirmChannel | null = null;
    try {
      channel = await connection.createConfirmChannel();
      const current = channel;
      // The `close` that follows a channel error is what sets it up again.
      current.on('error', () => undefined);
      current.on('close', () => this.onChannelClosed(queue, connection, current));

      await current.prefetch(this.config.prefetch);
      await current.assertExchange(this.config.exchange, 'topic', { durable: true });
      await current.assertQueue(
        queue,
        subscription.transient
          ? { durable: false, exclusive: true, autoDelete: true }
          : { durable: true },
      );
      for (const routingKey of subscription.routingKeys) {
        await current.bindQueue(queue, this.config.exchange, routingKey);
      }
      if (!subscription.transient) {
        await current.assertQueue(waitQueueOf(queue), {
          durable: true,
          arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': queue },
        });
        await current.assertQueue(deadQueueOf(queue), { durable: true });
      }

      if (this.closed || this.connection !== connection) {
        await closeQuietly(current);
        return;
      }

      const active: ActiveSubscription = { channel: current, consumerTag: null };
      this.active.set(queue, active);
      const { consumerTag } = await current.consume(
        queue,
        (delivery) => this.track(this.deliver(subscription, current, delivery)),
        { noAck: false },
      );
      active.consumerTag = consumerTag;
      this.resubscribeAttempts.delete(queue);
      this.logger.log(`Consumindo ${queue} (${subscription.routingKeys.join(', ')})`);
    } catch (error: unknown) {
      if (channel && this.active.get(queue)?.channel === channel) this.active.delete(queue);
      if (channel) await closeQuietly(channel);
      if (this.closed || this.connection !== connection) return;

      const delay = this.scheduleResubscribe(queue, connection);
      this.logger.warn(
        `Could not subscribe to ${queue} at ${this.address}: ${this.describe(error)}. Retrying in ${delay} ms.`,
      );
    }
  }

  // A channel closed by the broker (error, queue deleted) brings down only its
  // subscription, which is set up again. The channels closed together with the
  // connection are set up by the reconnection instead.
  private onChannelClosed(queue: string, connection: ChannelModel, channel: ConfirmChannel): void {
    if (this.active.get(queue)?.channel !== channel) return;

    this.active.delete(queue);
    if (this.closed || this.connection !== connection) return;

    const delay = this.scheduleResubscribe(queue, connection);
    this.logger.warn(`Channel of ${queue} closed; subscribing again in ${delay} ms.`);
  }

  private scheduleResubscribe(queue: string, connection: ChannelModel): number {
    const attempts = (this.resubscribeAttempts.get(queue) ?? 0) + 1;
    const delay = backoffDelayMs(attempts);
    if (this.resubscribeTimers.has(queue)) return delay;

    this.resubscribeAttempts.set(queue, attempts);
    this.resubscribeTimers.set(
      queue,
      setTimeout(() => {
        this.resubscribeTimers.delete(queue);
        this.startSetup(queue, connection);
      }, delay),
    );
    return delay;
  }

  private track(delivery: Promise<void>): void {
    const tracked = delivery.finally(() => {
      this.inFlight.delete(tracked);
    });
    this.inFlight.add(tracked);
  }

  /**
   * Handles one delivery (never rejects):
   * 1. invalid body → `<queue>.dead` with `MESSAGE_INVALID`;
   * 2. initial wait not served yet → `<queue>.wait` with `expiration = delayMs`;
   * 3. calls `onMessage` (an exception counts as a failure);
   * 4. success → `ack`;
   * 5. failure before the last attempt → `<queue>.wait` with the backoff;
   * 6. failure on the last attempt → `<queue>.dead` with `MAX_ATTEMPTS_EXCEEDED`.
   *
   * The original is confirmed only after the broker confirms the republication.
   */
  private async deliver(
    subscription: RabbitMqSubscription,
    channel: ConfirmChannel,
    delivery: ConsumeMessage | null,
  ): Promise<void> {
    const { queue } = subscription;
    // `null`: the broker cancelled the consumer (e.g. the queue was deleted).
    // Closing the channel sets the subscription up again.
    if (!delivery) {
      this.logger.warn(`Consumer of ${queue} cancelled by RabbitMQ; subscribing again.`);
      await closeQuietly(channel);
      return;
    }

    if (subscription.transient) {
      await this.deliverTransient(subscription, channel, delivery);
      return;
    }

    try {
      const headers: Headers = delivery.properties.headers ?? {};
      const parsed = parseBrokerMessage(delivery.content);
      if (parsed.isFailure) {
        const moved = await this.republishAndAck(channel, delivery, deadQueueOf(queue), {
          [RabbitMqConsumerHeaders.DEAD_REASON]: RabbitMqDeadReasons.MESSAGE_INVALID,
        });
        if (moved) {
          this.logger.error(
            `Message ${this.idOf(delivery)} (${this.typeOf(delivery)}) discarded to ${deadQueueOf(queue)}: ${RabbitMqDeadReasons.MESSAGE_INVALID}`,
          );
        }
        return;
      }

      const message = parsed.instance;
      const delayMs = subscription.delayMs ?? 0;
      if (delayMs > 0 && headers[RabbitMqConsumerHeaders.DELAYED] !== true) {
        await this.republishAndAck(
          channel,
          delivery,
          waitQueueOf(queue),
          { [RabbitMqConsumerHeaders.DELAYED]: true },
          delayMs,
        );
        return;
      }

      const attempt = attemptOf(headers);
      const errors = await this.run(subscription, message);
      if (!errors) {
        channel.ack(delivery);
        return;
      }

      const lastError = errors.join(', ').slice(0, LAST_ERROR_MAX_LENGTH);
      const description = `Message ${message.messageId} (${message.type})`;
      if (attempt < this.config.maxAttempts) {
        const delay = backoffDelayMs(attempt);
        const moved = await this.republishAndAck(
          channel,
          delivery,
          waitQueueOf(queue),
          {
            [RabbitMqConsumerHeaders.ATTEMPT]: attempt + 1,
            [RabbitMqConsumerHeaders.LAST_ERROR]: lastError,
          },
          delay,
        );
        if (moved) {
          this.logger.warn(
            `${description} failed attempt ${attempt} of ${this.config.maxAttempts} in ${queue}; next attempt in ${delay} ms.`,
          );
        }
        return;
      }

      const moved = await this.republishAndAck(channel, delivery, deadQueueOf(queue), {
        [RabbitMqConsumerHeaders.DEAD_REASON]: RabbitMqDeadReasons.MAX_ATTEMPTS_EXCEEDED,
        [RabbitMqConsumerHeaders.ATTEMPT]: attempt,
        [RabbitMqConsumerHeaders.LAST_ERROR]: lastError,
      });
      if (moved) {
        this.logger.error(
          `${description} discarded to ${deadQueueOf(queue)}: ${RabbitMqDeadReasons.MAX_ATTEMPTS_EXCEEDED} after ${attempt} attempt(s).`,
        );
      }
    } catch (error: unknown) {
      // e.g. `ack` on a channel that has just closed: the broker delivers the
      // unconfirmed message again.
      this.logger.warn(
        `Delivery of ${this.idOf(delivery)} in ${queue} was not settled: ${this.describe(error)}`,
      );
    }
  }

  /**
   * Handles one delivery of a transient subscription (never rejects): an
   * invalid body is dropped, a valid one goes to `onMessage`, and the delivery
   * is always confirmed (`ack`), so nothing is retried nor discarded to another
   * queue. Failures and invalid bodies go only to the log, without the payload.
   */
  private async deliverTransient(
    subscription: RabbitMqSubscription,
    channel: ConfirmChannel,
    delivery: ConsumeMessage,
  ): Promise<void> {
    const { queue } = subscription;
    try {
      const parsed = parseBrokerMessage(delivery.content);
      if (parsed.isFailure) {
        this.logger.warn(
          `Message ${this.idOf(delivery)} (${this.typeOf(delivery)}) dropped from ${queue}: ${MessagingErrors.MESSAGE_INVALID}`,
        );
      } else {
        const message = parsed.instance;
        const errors = await this.run(subscription, message);
        if (errors) {
          this.logger.warn(
            `Message ${message.messageId} (${message.type}) failed in ${queue} and will not be retried: ${errors.join(', ').slice(0, LAST_ERROR_MAX_LENGTH)}`,
          );
        }
      }
      channel.ack(delivery);
    } catch (error: unknown) {
      // e.g. `ack` on a channel that has just closed: the queue goes away with it.
      this.logger.warn(
        `Delivery of ${this.idOf(delivery)} in ${queue} was not settled: ${this.describe(error)}`,
      );
    }
  }

  // `null` on success; otherwise the codes of the failure.
  private async run(
    subscription: RabbitMqSubscription,
    message: Parameters<ConsumeMessageIn['onMessage']>[0],
  ): Promise<string[] | null> {
    try {
      const result = await subscription.onMessage(message);
      return result.isFailure ? result.errors : null;
    } catch (error: unknown) {
      return [this.describe(error)];
    }
  }

  // Republishes the delivery to `queue` through the default exchange, keeping
  // body, `messageId`, `type`, `timestamp`, `contentType` and the previous
  // headers, and confirms the original only after the broker confirms the copy.
  // When the republication fails, the original goes back to its queue (`nack`
  // with requeue) and is delivered again. Returns whether the copy was confirmed.
  private async republishAndAck(
    channel: ConfirmChannel,
    delivery: ConsumeMessage,
    queue: string,
    headers: Headers,
    expirationMs?: number,
  ): Promise<boolean> {
    const { properties } = delivery;
    const options: Options.Publish = {
      persistent: true,
      headers: { ...properties.headers, ...headers },
    };
    if (properties.messageId !== undefined) options.messageId = properties.messageId;
    if (properties.type !== undefined) options.type = properties.type;
    if (properties.timestamp !== undefined) options.timestamp = properties.timestamp;
    if (properties.contentType !== undefined) options.contentType = properties.contentType;
    if (properties.appId !== undefined) options.appId = properties.appId;
    if (expirationMs !== undefined) options.expiration = String(expirationMs);

    try {
      await new Promise<void>((resolve, reject) => {
        channel.publish(DEFAULT_EXCHANGE, queue, delivery.content, options, (error: unknown) =>
          error ? reject(error) : resolve(),
        );
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Message ${this.idOf(delivery)} was not confirmed in ${queue}; returning it to its queue: ${this.describe(error)}`,
      );
      channel.nack(delivery, false, true);
      return false;
    }

    channel.ack(delivery);
    return true;
  }

  private idOf(delivery: ConsumeMessage): string {
    return delivery.properties.messageId ?? 'without messageId';
  }

  private typeOf(delivery: ConsumeMessage): string {
    return delivery.properties.type ?? 'unknown';
  }

  private describe(error: unknown): string {
    return redactCredentials(errorMessage(error), this.config.url);
  }
}

// Number of the current attempt: `x-jaja-attempt`, or 1 when missing or invalid.
function attemptOf(headers: Headers): number {
  const value = Number(headers[RabbitMqConsumerHeaders.ATTEMPT]);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

async function closeQuietly(target: Closable): Promise<void> {
  try {
    await target.close();
  } catch {
    // Already closed.
  }
}
