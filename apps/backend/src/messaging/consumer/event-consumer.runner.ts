import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MESSAGE_CONSUMER, Result, ResultError } from '@mentoria-360/shared';
import type { BrokerMessage, MessageConsumer } from '@mentoria-360/shared';
import { ActiveTransactionManager } from '../../db/active-transaction.manager.js';
import { PrismaService } from '../../db/prisma.service.js';
import { errorMessage } from '../error-message.util.js';
import type { RabbitMqSubscription } from '../rabbitmq/rabbitmq-message.consumer.js';
import type { TransactionalEventConsumer } from './event-consumer.js';
import { EventConsumerRegistry } from './event-consumer.registry.js';
import { causationOf, ConsumerTransactionContext } from './message-causation.js';
import { ProcessedMessagePrisma } from './processed-message.prisma.js';

const QUEUE_PREFIX = 'jaja.';

export type ConsumeOutcome = 'processed' | 'duplicate';

// Subscribes the registered consumers when the application starts and runs
// each message in a single transaction: "processed" mark, handler (use case)
// and new events of the outbox are committed or rolled back together. Depends
// only on the `MessageConsumer` port: retries, waits and discards belong to the
// broker adapter.
@Injectable()
export class EventConsumerRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventConsumerRunner.name);
  private readonly enabled: boolean;

  constructor(
    private readonly registry: EventConsumerRegistry,
    private readonly prisma: PrismaService,
    private readonly processedMessages: ProcessedMessagePrisma,
    @Inject(MESSAGE_CONSUMER) private readonly messageConsumer: MessageConsumer,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('EVENT_CONSUMERS_ENABLED')?.trim() !== 'false';
  }

  // Runs after every `onModuleInit`, so all the consumers are registered. The
  // subscriptions do not wait for the broker; a failed one is a programming
  // error (empty or repeated queue) and stops the startup.
  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Consumo de eventos desligado (EVENT_CONSUMERS_ENABLED=false)');
      return;
    }

    const consumers = this.registry.list();
    for (const consumer of consumers) {
      const subscription: RabbitMqSubscription = {
        queue: `${QUEUE_PREFIX}${consumer.name}`,
        routingKeys: [consumer.eventType],
        delayMs: consumer.delayMs ?? 0,
        onMessage: async (message) => {
          const result = await this.handle(consumer, message);
          return result.isFailure ? Result.fail(result.errors) : Result.ok();
        },
      };

      const subscribed = await this.messageConsumer.subscribe(subscription);
      if (subscribed.isFailure) {
        throw new Error(
          `Consumer ${consumer.name} could not subscribe to ${subscription.queue}: ${subscribed.errors.join(', ')}`,
        );
      }
    }

    this.logger.log(`${consumers.length} consumidor(es) assinado(s)`);
  }

  /**
   * Processes one message in a single transaction (public for the tests):
   * 1. builds the context of the consumer with the causation of the message;
   * 2. marks the message as processed; when it already was, ends with
   *    `'duplicate'` without calling the handler;
   * 3. calls the handler with an `ActiveTransactionManager` over that context;
   * 4. a failed `Result` is thrown as `ResultError`, rolling everything back.
   *
   * Never rejects: an exception becomes `Result.fail` with its codes, so the
   * adapter schedules a new attempt. Logs only id, type and consumer, never the
   * payload nor the metadata.
   */
  async handle(
    consumer: TransactionalEventConsumer,
    message: BrokerMessage,
  ): Promise<Result<ConsumeOutcome>> {
    const description = `Mensagem ${message.messageId} (${message.type})`;
    try {
      const outcome = await this.prisma.runInTransaction<ConsumeOutcome>(async (tx) => {
        const context: ConsumerTransactionContext = { ...tx, causation: causationOf(message) };

        const marked = await this.processedMessages.markProcessed(consumer.name, message, context);
        if (!marked) return 'duplicate';

        const result = await consumer.handle(message, new ActiveTransactionManager(context));
        if (result.isFailure) throw new ResultError(result.errors);
        return 'processed';
      });

      if (outcome === 'duplicate') {
        this.logger.debug(`${description} já processada por ${consumer.name}; repetição ignorada`);
      } else {
        this.logger.log(`${description} processada por ${consumer.name}`);
      }
      return Result.ok(outcome);
    } catch (error: unknown) {
      const errors =
        error instanceof ResultError && error.errors.length ? error.errors : [errorMessage(error)];
      this.logger.warn(`${description} falhou em ${consumer.name}: ${errors.join(', ')}`);
      return Result.fail(errors);
    }
  }
}
