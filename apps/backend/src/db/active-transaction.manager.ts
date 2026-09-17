import { TransactionContext, TransactionManager } from '@mentoria-360/shared';

// `TransactionManager` over a transaction that is already open. Lets a use case
// take part in the transaction of its caller (e.g. an event consumer that stores
// the "processed" mark and then calls the use case) without changing the use
// case: it keeps calling `runInTransaction` and passing the `tx` to its writes.
//
// It never opens, commits nor rolls back anything: `operation` runs with the
// given context, and an error thrown by it goes up to whoever opened the
// transaction. The rollback always belongs to the owner of the transaction.
export class ActiveTransactionManager<
  CTX extends TransactionContext = TransactionContext,
> implements TransactionManager<CTX> {
  constructor(private readonly context: CTX) {}

  runInTransaction<T>(operation: (context: CTX) => Promise<T>): Promise<T> {
    return operation(this.context);
  }
}
