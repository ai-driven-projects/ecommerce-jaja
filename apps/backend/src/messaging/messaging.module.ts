import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { EventConsumerRegistry } from './consumer/event-consumer.registry.js';
import { EventConsumerRunner } from './consumer/event-consumer.runner.js';
import { ProcessedMessagePrisma } from './consumer/processed-message.prisma.js';
import { LiveEventFeed } from './live/live-event-feed.js';
import { EventTimelinePrisma } from './monitoring/event-timeline.prisma.js';
import { DomainEventPrisma } from './outbox/domain-event.prisma.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { OutboxPrisma } from './outbox/outbox.prisma.js';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module.js';

// Messaging infrastructure of the backend: the outbox (`DomainEventPrisma`,
// `OutboxPrisma`), the relay that publishes the pending events, the event
// consumers (`EventConsumerRegistry`, `EventConsumerRunner`,
// `ProcessedMessagePrisma`) and the live feed (`LiveEventFeed`, one copy of every
// event per instance for live notices). Controllers hand `DomainEventPrisma` to
// the use cases, like the other `*.prisma.ts` adapters, the business modules
// register their consumers in `EventConsumerRegistry`, and the live streams read
// `LiveEventFeed.events$`.
//
// The broker is the imported module, which provides `MESSAGE_PUBLISHER` and
// `BROKER_SUBSCRIBER` (see `broker/`). Swapping the broker means importing
// another module here: the relay, the runner, the live feed and the use cases
// depend on the ports, and only this file imports from `rabbitmq/`.
//
// `EventTimelinePrisma` is a monitoring read of the outbox, the "processed"
// marks and the registered consumers (e.g. the admin order monitor); it never
// queries the broker.
@Module({
  imports: [DbModule, RabbitMqModule],
  providers: [
    DomainEventPrisma,
    OutboxPrisma,
    OutboxRelay,
    ProcessedMessagePrisma,
    EventConsumerRegistry,
    EventConsumerRunner,
    LiveEventFeed,
    EventTimelinePrisma,
  ],
  exports: [
    DomainEventPrisma,
    RabbitMqModule,
    EventConsumerRegistry,
    LiveEventFeed,
    EventTimelinePrisma,
  ],
})
export class MessagingModule {}
