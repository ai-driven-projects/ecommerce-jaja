import { TransactionContext, TransactionManager } from '@mentoria-360/shared'

// Runs the operation with the same `context`, so a test can check that every
// write received it. `rolledBack` becomes `true` when the operation throws (the
// error is rethrown); nothing is actually undone here: the real rollback belongs
// to the database.
export class FakeTransactionManager implements TransactionManager {
  readonly context: TransactionContext = {}
  calls = 0
  rolledBack = false

  async runInTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    this.calls += 1
    try {
      return await operation(this.context)
    } catch (error) {
      this.rolledBack = true
      throw error
    }
  }
}
