import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MESSAGE_CONSUMER, Result } from '@mentoria-360/shared';
import type { BrokerMessage, MessageConsumer } from '@mentoria-360/shared';
import { Observable, Subject } from 'rxjs';
import type { RabbitMqSubscription } from '../rabbitmq/rabbitmq-message.consumer.js';

const QUEUE_PREFIX = 'jaja.live';
// Every event published to the exchange.
const ALL_EVENTS = '#';

/**
 * Live feed of the events of this backend instance: **one copy of each event
 * per instance**, only for live notices (e.g. the stream of an order), with no
 * delivery guarantee.
 *
 * On startup, when `LIVE_EVENTS_ENABLED` is not `"false"`, subscribes to a
 * transient queue of its own (`jaja.live.<host>.<pid>.<suffix>`, exclusive and
 * deleted with the connection) bound to every event (`#`), and emits each
 * message received in `events$`, in memory, to every subscriber of this
 * instance. Work queues split the messages between the instances; this queue
 * gives each instance its own copy, so the notice reaches the instance that
 * holds the open connection.
 *
 * No idempotency, no retries and no discard: a message published while the
 * instance has no connection to the broker is lost by the feed (the outbox, the
 * business consumers and the orders are not affected), and the screens read the
 * state again from the REST API.
 */
@Injectable()
export class LiveEventFeed implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LiveEventFeed.name);
  private readonly enabled: boolean;
  private readonly subject = new Subject<BrokerMessage>();

  /** Every message received by this instance, while the feed is enabled. */
  readonly events$: Observable<BrokerMessage> = this.subject.asObservable();

  constructor(
    @Inject(MESSAGE_CONSUMER) private readonly messageConsumer: MessageConsumer,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('LIVE_EVENTS_ENABLED')?.trim() !== 'false';
  }

  // The subscription does not wait for the broker. A failed one is a
  // programming error (invalid or repeated queue) and stops the startup.
  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Feed de eventos ao vivo desligado (LIVE_EVENTS_ENABLED=false)');
      return;
    }

    const queue = liveQueueName();
    const subscription: RabbitMqSubscription = {
      queue,
      routingKeys: [ALL_EVENTS],
      transient: true,
      // A notice never fails: the broker always gets the confirmation.
      onMessage: async (message) => {
        this.subject.next(message);
        return Result.ok();
      },
    };

    const subscribed = await this.messageConsumer.subscribe(subscription);
    if (subscribed.isFailure) {
      throw new Error(
        `Live event feed could not subscribe to ${queue}: ${subscribed.errors.join(', ')}`,
      );
    }
    this.logger.log(`Feed de eventos ao vivo assinado em ${queue}`);
  }

  // Ends the streams that are still open.
  onModuleDestroy(): void {
    this.subject.complete();
  }
}

// `jaja.live.<host>.<pid>.<6 random characters>`, only with `[a-z0-9.-]`.
export function liveQueueName(host = hostname(), pid = process.pid): string {
  const suffix = randomBytes(3).toString('hex');
  const safeHost =
    host
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '') || 'host';
  return `${QUEUE_PREFIX}.${safeHost}.${pid}.${suffix}`;
}
