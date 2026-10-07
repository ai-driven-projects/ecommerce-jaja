import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Result } from '@mentoria-360/shared';
import type { BrokerMessage } from '@mentoria-360/shared';
import { Observable, Subject } from 'rxjs';
import { BROKER_SUBSCRIBER } from '../broker/broker-subscriber.js';
import type { BrokerSubscriber, BrokerSubscription } from '../broker/broker-subscriber.js';

// Name of the subscription; the adapter makes one queue per instance out of it.
export const LIVE_SUBSCRIPTION_NAME = 'live';

/**
 * Live feed of the events of this backend instance: **one copy of each event
 * per instance**, only for live notices (e.g. the stream of an order), with no
 * delivery guarantee.
 *
 * On startup, when `LIVE_EVENTS_ENABLED` is not `"false"`, makes a `broadcast`
 * subscription to every event (no event types) and emits each message received
 * in `events$`, in memory, to every subscriber of this instance. `work`
 * subscriptions split the messages between the instances; `broadcast` gives
 * each instance its own copy, so the notice reaches the instance that holds the
 * open connection. How that copy is made (e.g. a queue per instance) is up to
 * the broker adapter.
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
    @Inject(BROKER_SUBSCRIBER) private readonly subscriber: BrokerSubscriber,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('LIVE_EVENTS_ENABLED')?.trim() !== 'false';
  }

  // The subscription does not wait for the broker. A failed one is a
  // programming error (invalid or repeated name) and stops the startup.
  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Feed de eventos ao vivo desligado (LIVE_EVENTS_ENABLED=false)');
      return;
    }

    const subscription: BrokerSubscription = {
      name: LIVE_SUBSCRIPTION_NAME,
      eventTypes: [],
      mode: 'broadcast',
      // A notice never fails.
      onMessage: async (message) => {
        this.subject.next(message);
        return Result.ok();
      },
    };

    const subscribed = await this.subscriber.subscribe(subscription);
    if (subscribed.isFailure) {
      throw new Error(`Live event feed could not subscribe: ${subscribed.errors.join(', ')}`);
    }
    this.logger.log('Feed de eventos ao vivo assinado');
  }

  // Ends the streams that are still open.
  onModuleDestroy(): void {
    this.subject.complete();
  }
}
