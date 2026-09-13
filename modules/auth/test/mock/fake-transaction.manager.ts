import { TransactionContext, TransactionManager } from '@mentoria-360/shared'

export class FakeTransactionManager implements TransactionManager {
  readonly context: TransactionContext = {}
  calls = 0

  async runInTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    this.calls += 1
    return operation(this.context)
  }
}
