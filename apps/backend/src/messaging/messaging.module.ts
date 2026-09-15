import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MESSAGE_PUBLISHER } from '@mentoria-360/shared';
import type { MessagePublisher } from '@mentoria-360/shared';
import { DbModule } from '../db/db.module.js';
import { DomainEventPrisma } from './outbox/domain-event.prisma.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { OutboxPrisma } from './outbox/outbox.prisma.js';
import { RabbitMqMessagePublisher } from './rabbitmq/rabbitmq-message.publisher.js';

const DEFAULT_RABBITMQ_URL = 'amqp://jaja:jaja@localhost:5672';
const DEFAULT_RABBITMQ_EXCHANGE = 'jaja.events';

// Messaging infrastructure of the backend: the outbox (`DomainEventPrisma`,
// `OutboxPrisma`), the relay that publishes the pending events and the broker
// adapter. Controllers hand `DomainEventPrisma` to the use cases, like the other
// `*.prisma.ts` adapters.
@Module({
  imports: [DbModule],
  providers: [
    DomainEventPrisma,
    OutboxPrisma,
    OutboxRelay,
    {
      // Swapping the broker means swapping only this provider: the relay and
      // the use cases depend on the `MessagePublisher` port, never on RabbitMQ.
      provide: MESSAGE_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MessagePublisher =>
        new RabbitMqMessagePublisher({
          url: config.get<string>('RABBITMQ_URL')?.trim() || DEFAULT_RABBITMQ_URL,
          exchange: config.get<string>('RABBITMQ_EXCHANGE')?.trim() || DEFAULT_RABBITMQ_EXCHANGE,
          // Empty: no inspection queue.
          inspectionQueue: config.get<string>('RABBITMQ_INSPECTION_QUEUE')?.trim() || undefined,
        }),
    },
  ],
  exports: [DomainEventPrisma, MESSAGE_PUBLISHER],
})
export class MessagingModule {}
