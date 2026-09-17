import { describe, expect, it, vi } from 'vitest';
import { ActiveTransactionManager } from '../../src/db/active-transaction.manager.js';
import { PrismaTransactionContext } from '../../src/db/prisma.service.js';

function openTransaction() {
  const $transaction = vi.fn();
  const context = { client: { $transaction } } as unknown as PrismaTransactionContext;
  return { context, $transaction };
}

describe('ActiveTransactionManager', () => {
  it('runs the operation with the same context and returns its value', async () => {
    const { context } = openTransaction();
    const manager = new ActiveTransactionManager(context);

    const received: PrismaTransactionContext[] = [];
    const value = await manager.runInTransaction(async (tx) => {
      received.push(tx);
      return 42;
    });
    await manager.runInTransaction(async (tx) => {
      received.push(tx);
    });

    expect(value).toBe(42);
    expect(received).toHaveLength(2);
    expect(received.every((tx) => tx === context)).toBe(true);
  });

  it('opens no transaction', async () => {
    const { context, $transaction } = openTransaction();

    await new ActiveTransactionManager(context).runInTransaction(async () => undefined);

    expect($transaction).not.toHaveBeenCalled();
  });

  it('lets the error thrown by the operation go up without catching it', async () => {
    const { context } = openTransaction();
    const error = new Error('aggregate write failed');

    await expect(
      new ActiveTransactionManager(context).runInTransaction(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});
