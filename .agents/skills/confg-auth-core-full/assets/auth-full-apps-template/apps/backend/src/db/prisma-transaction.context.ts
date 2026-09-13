import type { Prisma, PrismaClient } from '@prisma/client';
import type { TransactionContext } from '__SHARED_PACKAGE_NAME__';
import type { PrismaTransactionContext } from './prisma.service';

export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export function resolvePrismaExecutor(
  tx: TransactionContext | undefined,
  fallback: PrismaClient,
): PrismaExecutor {
  if (tx && 'client' in tx) {
    return (tx as PrismaTransactionContext).client;
  }
  return fallback;
}
