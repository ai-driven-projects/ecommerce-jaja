import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MESSAGE_PUBLISHER } from '@mentoria-360/shared';
import type { MessagePublisher } from '@mentoria-360/shared';
import { readInteger } from '../config.util.js';
import { errorMessage } from '../error-message.util.js';
import { OutboxBatchResult, OutboxPrisma } from './outbox.prisma.js';
import { publishInOrder } from './publish-in-order.js';

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MIN_POLL_INTERVAL_MS = 100;
// Largest delay accepted by `setInterval`.
const MAX_POLL_INTERVAL_MS = 2_147_483_647;
const DEFAULT_BATCH_SIZE = 50;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 500;

interface FailedEvent {
  readonly id: string;
  readonly type: string;
  readonly error: string;
}

// Publishes the pending events of the outbox on an interval, inside the backend
// process (it is not an HTTP route). It depends only on the `MessagePublisher`
// port, so swapping the broker does not change it.
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly enabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<OutboxBatchResult> | null = null;

  constructor(
    private readonly outbox: OutboxPrisma,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: MessagePublisher,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('OUTBOX_RELAY_ENABLED')?.trim() !== 'false';
    this.pollIntervalMs = readInteger(
      config.get<string>('OUTBOX_POLL_INTERVAL_MS'),
      DEFAULT_POLL_INTERVAL_MS,
      MIN_POLL_INTERVAL_MS,
      MAX_POLL_INTERVAL_MS,
    );
    this.batchSize = readInteger(
      config.get<string>('OUTBOX_BATCH_SIZE'),
      DEFAULT_BATCH_SIZE,
      MIN_BATCH_SIZE,
      MAX_BATCH_SIZE,
    );
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('Outbox relay disabled (OUTBOX_RELAY_ENABLED=false)');
      return;
    }

    this.timer = setInterval(() => void this.runOnce(), this.pollIntervalMs);
    this.logger.log(
      `Outbox relay started: every ${this.pollIntervalMs} ms, up to ${this.batchSize} events per cycle`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.running;
  }

  // One cycle. Public for the tests. A cycle that starts while the previous one
  // is still running ends without doing anything, so cycles never overlap.
  runOnce(): Promise<OutboxBatchResult> {
    if (this.running) return Promise.resolve({ published: 0, failed: 0 });

    this.running = this.cycle().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  // Never rejects: an unexpected error is logged and the next cycle runs normally.
  private async cycle(): Promise<OutboxBatchResult> {
    try {
      let failure = null as FailedEvent | null;

      const result = await this.outbox.processPendingBatch(this.batchSize, async (events) => {
        const outcome = await publishInOrder(events, this.publisher);
        if (outcome.failure) {
          const event = events.find((item) => item.id === outcome.failure?.id);
          failure = { ...outcome.failure, type: event?.type ?? 'unknown' };
        }
        return outcome;
      });

      if (result.published > 0) {
        this.logger.log(`${result.published} evento(s) publicado(s)`);
      }
      // Only id, type and error: the payload and the metadata may carry personal data.
      if (failure) {
        this.logger.warn(
          `Event ${failure.id} (${failure.type}) was not published and stays pending: ${failure.error}`,
        );
      }
      return result;
    } catch (error: unknown) {
      this.logger.error(`Outbox relay cycle failed: ${errorMessage(error)}`);
      return { published: 0, failed: 0 };
    }
  }
}
