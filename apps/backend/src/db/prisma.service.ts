import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { TransactionContext, TransactionManager } from '@mentoria-360/shared';
import { Prisma, PrismaClient } from '@prisma/client';

export interface PrismaTransactionContext extends TransactionContext {
  client: Prisma.TransactionClient;
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
