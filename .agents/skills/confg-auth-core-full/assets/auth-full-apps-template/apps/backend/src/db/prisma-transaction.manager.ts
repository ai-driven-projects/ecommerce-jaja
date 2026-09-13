import { Injectable } from '@nestjs/common';
import type { TransactionManager } from '__SHARED_PACKAGE_NAME__';
import { PrismaService, type PrismaTransactionContext } from './prisma.service';

@Injectable()
export class PrismaTransactionManager
  implements TransactionManager<PrismaTransactionContext>
{
  constructor(private readonly prisma: PrismaService) {}

  runInTransaction<T>(
    operation: (context: PrismaTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.prisma.runInTransaction(operation);
  }
}
