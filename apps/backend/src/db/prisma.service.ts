import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { TransactionContext, TransactionManager } from '@mentoria-360/shared';
import { Prisma, PrismaClient } from '@prisma/client';

export interface PrismaTransactionContext extends TransactionContext {
  client: Prisma.TransactionClient;
}

// Connections of the pool of each backend instance, the default of `pg`.
export const DEFAULT_DB_POOL_MAX = 10;
export const MAX_DB_POOL_MAX = 100;

/**
 * `DB_POOL_MAX`: connections of the pool of **this instance**, an integer from
 * 1 to `MAX_DB_POOL_MAX`; missing, blank or invalid falls back to
 * `DEFAULT_DB_POOL_MAX`. Every transaction (an HTTP command, the outbox relay,
 * each event being consumed) holds one connection until it ends, so the pool
 * caps how much runs at the same time. The sum over every instance must stay
 * below `max_connections` of the database.
 */
export function databasePoolMax(value: string | undefined): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d+$/.test(text)) return DEFAULT_DB_POOL_MAX;
  const max = Number(text);
  return max >= 1 && max <= MAX_DB_POOL_MAX ? max : DEFAULT_DB_POOL_MAX;
}

@Injectable()
export class PrismaService
  implements
    OnModuleInit,
    OnApplicationShutdown,
    TransactionManager<PrismaTransactionContext>
{
  readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
        max: databasePoolMax(process.env.DB_POOL_MAX),
      }),
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  // Disconnects in the last shutdown hook. Nest runs `onModuleDestroy` of the
  // deepest modules first, and `DbModule` is deeper than the modules that use
  // it (e.g. `MessagingModule`), so disconnecting there could close the client
  // before the outbox relay and the event consumers finish the transactions in
  // progress. `onApplicationShutdown` runs only after every `onModuleDestroy`.
  async onApplicationShutdown() {
    await this.client.$disconnect();
  }

  async runInTransaction<T>(
    operation: (context: PrismaTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (tx) => {
      return operation({ client: tx });
    });
  }
}
