import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  BrokerMessage,
  MessagePublisher,
  PublishMessageIn,
  PublishMessageOptions,
  Result,
} from '@mentoria-360/shared';
import amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel, Options } from 'amqplib';
import { errorMessage } from '../error-message.util.js';
import { MessagingErrors } from '../messaging-errors.js';
import { brokerAddress, redactCredentials } from './rabbitmq-url.util.js';

export interface RabbitMqPublisherConfig {
  // Carries user and password: never logged nor copied into an error message.
  readonly url: string;
  readonly exchange: string;
  // Development only: durable queue bound with `#` that receives a copy of every
  // event. Empty or missing: no queue is declared.
  readonly inspectionQueue?: string;
}

// A stuck connection attempt gives up after 5 s, well below the 30 s timeout of
// the relay transaction that is waiting for the publication.
const CONNECT_TIMEOUT_MS = 5_000;
const APP_ID = 'jaja-backend';
const PUBLISHER_CLOSED = 'RabbitMQ publisher is closed';

type Closable = { close(): Promise<void> };

// RabbitMQ adapter of the `MessagePublisher` port, created by the factory of
// `MessagingModule`. The connection is lazy: it opens on the first publication
// (and once at startup, without blocking it), and a dropped connection is
// discarded so the next publication reconnects. The backend never depends on
// the broker to start or to answer HTTP: while it is down, publications fail
// with `MESSAGE_BROKER_UNAVAILABLE` and the events stay pending in the outbox.
export class RabbitMqMessagePublisher implements MessagePublisher, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqMessagePublisher.name);
  // `host:port` of the broker, the only identification that goes to the logs.
  private readonly address: string;
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connecting: Promise<ConfirmChannel> | null = null;
  private closed = false;

  constructor(private readonly config: RabbitMqPublisherConfig) {
    this.address = brokerAddress(config.url);
  }

  // Warm-up: tries to connect without awaiting, so the startup never waits for
  // the broker; a failure only leaves a warning (logged by `connect`).
  onModuleInit(): void {
    this.ensureChannel().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    await this.connecting?.catch(() => undefined);

    const { channel, connection } = this;
    this.channel = null;
    this.connection = null;
    if (channel) await closeQuietly(channel);
    if (connection) await closeQuietly(connection);
  }

  async publish({ message, options }: PublishMessageIn): Promise<Result<void>> {
    let channel: ConfirmChannel;
    try {
      channel = await this.ensureChannel();
    } catch {
      return Result.fail(MessagingErrors.MESSAGE_BROKER_UNAVAILABLE);
    }

    try {
      await this.publishConfirmed(channel, message, options);
      return Result.ok();
    } catch (error: unknown) {
      this.logger.warn(
        `Message ${message.messageId} (${message.type}) was not confirmed by RabbitMQ at ${this.address}: ${this.describe(error)}`,
      );
      return Result.fail(MessagingErrors.MESSAGE_PUBLISH_FAILED);
    }
  }

  // Resolves only when the broker confirms the message (ack); a nack or an error
  // while publishing rejects.
  private publishConfirmed(
    channel: ConfirmChannel,
    message: BrokerMessage,
    options?: PublishMessageOptions,
  ): Promise<void> {
    const routingKey = options?.routingKey ?? message.type;
    const occurredAt = new Date(message.occurredAt);
    const body = {
      messageId: message.messageId,
      type: message.type,
      payload: message.payload,
      metadata: message.metadata,
      occurredAt: occurredAt.toISOString(),
    };
    const properties: Options.Publish = {
      persistent: true,
      contentType: 'application/json',
      messageId: message.messageId,
      type: message.type,
      // AMQP timestamps are seconds since the epoch.
      timestamp: Math.floor(occurredAt.getTime() / 1000),
      appId: APP_ID,
      headers: options?.headers,
    };

    return new Promise<void>((resolve, reject) => {
      channel.publish(
        this.config.exchange,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        properties,
        (error: unknown) => (error ? reject(error) : resolve()),
      );
    });
  }

  // Concurrent publications without a connection share the attempt in
  // progress instead of opening one connection each.
  private ensureChannel(): Promise<ConfirmChannel> {
    if (this.closed) return Promise.reject(new Error(PUBLISHER_CLOSED));
    if (this.channel) return Promise.resolve(this.channel);

    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect(): Promise<ConfirmChannel> {
    let connection: ChannelModel | null = null;
    try {
      connection = await amqp.connect(this.config.url, { timeout: CONNECT_TIMEOUT_MS });
      const current = connection;
      // An `error` event without a listener would crash the process. amqplib
      // emits `close` after it; both discard the connection.
      current.on('error', (error: Error) => this.discard(current, this.describe(error)));
      current.on('close', () => this.discard(current, 'connection closed'));

      const channel = await current.createConfirmChannel();
      channel.on('error', (error: Error) => this.discard(current, this.describe(error)));
      channel.on('close', () => this.discard(current, 'channel closed'));

      await channel.assertExchange(this.config.exchange, 'topic', { durable: true });
      const queue = this.config.inspectionQueue;
      if (queue) {
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, this.config.exchange, '#');
      }

      if (this.closed) throw new Error(PUBLISHER_CLOSED);

      this.connection = current;
      this.channel = channel;
      this.logger.log(`Connected to RabbitMQ at ${this.address} (exchange ${this.config.exchange})`);
      return channel;
    } catch (error: unknown) {
      if (connection) await closeQuietly(connection);
      if (!this.closed) {
        this.logger.warn(
          `RabbitMQ unavailable at ${this.address}: ${this.describe(error)}. Events stay pending until the broker is back.`,
        );
      }
      throw new Error(MessagingErrors.MESSAGE_BROKER_UNAVAILABLE);
    }
  }

  // Forgets the connection and its channel after `error`/`close`, so the next
  // publication opens a new one. Ignores events of connections already replaced.
  private discard(connection: ChannelModel, reason: string): void {
    if (this.connection !== connection) return;

    this.connection = null;
    this.channel = null;
    this.logger.warn(
      `RabbitMQ connection to ${this.address} lost (${reason}); the next publication reconnects.`,
    );
    void closeQuietly(connection);
  }

  private describe(error: unknown): string {
    return redactCredentials(errorMessage(error), this.config.url);
  }
}

async function closeQuietly(target: Closable): Promise<void> {
  try {
    await target.close();
  } catch {
    // Already closed.
  }
}
