import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MESSAGE_PUBLISHER } from '@mentoria-360/shared';
import type { MessagePublisher } from '@mentoria-360/shared';
import { BROKER_SUBSCRIBER } from '../broker/broker-subscriber.js';
import type { BrokerSubscriber } from '../broker/broker-subscriber.js';
import { readInteger } from '../config.util.js';
import { RabbitMqMessageConsumer } from './rabbitmq-message.consumer.js';
import { RabbitMqMessagePublisher } from './rabbitmq-message.publisher.js';
import { readQueueType } from './rabbitmq-queue-type.js';

const DEFAULT_RABBITMQ_URL = 'amqp://jaja:jaja@localhost:5672';
const DEFAULT_RABBITMQ_EXCHANGE = 'jaja.events';
const DEFAULT_CONSUMER_PREFETCH = 10;
const DEFAULT_CONSUMER_MAX_ATTEMPTS = 5;

// RabbitMQ implementation of the two broker ports of the backend: publication
// (`MESSAGE_PUBLISHER`, port of the shared package) and consumption
// (`BROKER_SUBSCRIBER`, port of the backend). Everything that is RabbitMQ lives
// in this folder: the settings (`RABBITMQ_*`), the connections, the exchange,
// the queue names and types and the `.wait`/`.dead` queues. An invalid
// `RABBITMQ_QUEUE_TYPE` throws in the factories and stops the startup.
//
// Another broker is another folder with a module that provides the same two
// tokens; `MessagingModule` imports one of them.
@Module({
  providers: [
    {
      provide: MESSAGE_PUBLISHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MessagePublisher =>
        new RabbitMqMessagePublisher({
          url: rabbitMqUrl(config),
          exchange: rabbitMqExchange(config),
          // Empty: no inspection queue.
          inspectionQueue: config.get<string>('RABBITMQ_INSPECTION_QUEUE')?.trim() || undefined,
          queueType: readQueueType(config.get<string>('RABBITMQ_QUEUE_TYPE')),
        }),
    },
    {
      // Its own connection, separate from the publisher's.
      provide: BROKER_SUBSCRIBER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BrokerSubscriber =>
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
          queueType: readQueueType(config.get<string>('RABBITMQ_QUEUE_TYPE')),
        }),
    },
  ],
  exports: [MESSAGE_PUBLISHER, BROKER_SUBSCRIBER],
})
export class RabbitMqModule {}

function rabbitMqUrl(config: ConfigService): string {
  return config.get<string>('RABBITMQ_URL')?.trim() || DEFAULT_RABBITMQ_URL;
}

function rabbitMqExchange(config: ConfigService): string {
  return config.get<string>('RABBITMQ_EXCHANGE')?.trim() || DEFAULT_RABBITMQ_EXCHANGE;
}
