import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MESSAGE_CONSUMER, MESSAGE_PUBLISHER } from '@mentoria-360/shared';
import type { MessageConsumer, MessagePublisher } from '@mentoria-360/shared';
import { DbModule } from '../db/db.module.js';
import { readInteger } from './config.util.js';
import { EventConsumerRegistry } from './consumer/event-consumer.registry.js';
import { EventConsumerRunner } from './consumer/event-consumer.runner.js';
import { ProcessedMessagePrisma } from './consumer/processed-message.prisma.js';
import { LiveEventFeed } from './live/live-event-feed.js';
import { EventTimelinePrisma } from './monitoring/event-timeline.prisma.js';
import { DomainEventPrisma } from './outbox/domain-event.prisma.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { OutboxPrisma } from './outbox/outbox.prisma.js';
import { RabbitMqMessageConsumer } from './rabbitmq/rabbitmq-message.consumer.js';
import { RabbitMqMessagePublisher } from './rabbitmq/rabbitmq-message.publisher.js';

const DEFAULT_RABBITMQ_URL = 'amqp://jaja:jaja@localhost:5672';
const DEFAULT_RABBITMQ_EXCHANGE = 'jaja.events';
const DEFAULT_CONSUMER_PREFETCH = 10;
const DEFAULT_CONSUMER_MAX_ATTEMPTS = 5;

// Messaging infrastructure of the backend: the outbox (`DomainEventPrisma`,
// `OutboxPrisma`), the relay that publishes the pending events, the event
// consumers (`EventConsumerRegistry`, `EventConsumerRunner`,
// `ProcessedMessagePrisma`), the live feed (`LiveEventFeed`, one copy of every
// event per instance for live notices) and the broker adapters. Controllers
// hand `DomainEventPrisma` to the use cases, like the other `*.prisma.ts`
// adapters, the business modules register their consumers in
// `EventConsumerRegistry`, and the live streams read `LiveEventFeed.events$`.
//
// Swapping the broker means swapping only the providers of `MESSAGE_PUBLISHER`
// and `MESSAGE_CONSUMER`: the relay, the runner and the use cases depend on the
// ports, never on RabbitMQ.
//
// `EventTimelinePrisma` is a monitoring read of the outbox, the "processed"
// marks and the registered consumers (e.g. the admin order monitor); it never
// queries the broker.
@Module({
  imports: [DbModule],
  providers: [
    DomainEventPrisma,
    OutboxPrisma,
    OutboxRelay,
    ProcessedMessagePrisma,
    EventConsumerRegistry,
    EventConsumerRunner,
    LiveEventFeed,
    EventTimelinePrisma,
    {
      provide: MESSAGE_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MessagePublisher =>
        new RabbitMqMessagePublisher({
          url: rabbitMqUrl(config),
          exchange: rabbitMqExchange(config),
          // Empty: no inspection queue.
          inspectionQueue: config.get<string>('RABBITMQ_INSPECTION_QUEUE')?.trim() || undefined,
        }),
    },
    {
      // Its own connection, separate from the publisher's.
      provide: MESSAGE_CONSUMER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MessageConsumer =>
        new RabbitMqMessageConsumer({
          url: rabbitMqUrl(config),
          exchange: rabbitMqExchange(config),
          prefetch: readInteger(
            config.get<string>('EVENT_CONSUMER_PREFETCH'),
            DEFAULT_CONSUMER_PREFETCH,
            1,
            100,
          ),
          maxAttempts: readInteger(
            config.get<string>('EVENT_CONSUMER_MAX_ATTEMPTS'),
            DEFAULT_CONSUMER_MAX_ATTEMPTS,
            1,
            20,
          ),
        }),
    },
  ],
  exports: [
    DomainEventPrisma,
    MESSAGE_PUBLISHER,
    EventConsumerRegistry,
    LiveEventFeed,
    EventTimelinePrisma,
  ],
})
export class MessagingModule {}

function rabbitMqUrl(config: ConfigService): string {
  return config.get<string>('RABBITMQ_URL')?.trim() || DEFAULT_RABBITMQ_URL;
}

function rabbitMqExchange(config: ConfigService): string {
  return config.get<string>('RABBITMQ_EXCHANGE')?.trim() || DEFAULT_RABBITMQ_EXCHANGE;
}
