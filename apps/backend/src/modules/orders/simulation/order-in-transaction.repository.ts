import type { Order, OrderRepository } from '@jaja/orders';
import type { Result, TransactionContext, TransactionManager } from '@mentoria-360/shared';
import type { OrderPrisma } from '../order.prisma.js';

/**
 * `OrderRepository` of the simulated services, over the transaction of the
 * consumer.
 *
 * The step use cases read the order with `findById`, which receives no
 * transaction in the shared contract. With the plain `OrderPrisma`, that read
 * took a **second** connection from the pool while the consumer already held one
 * for its transaction (the "processed" mark). Under load, with
 * `EVENT_CONSUMER_PREFETCH` × consumers at or above the pool size, every
 * connection ended up held by a consumer waiting for another one: nothing moved
 * until the transactions expired, and the outbox relay failed with "Unable to
 * start a transaction in the given time".
 *
 * Here `findById` runs inside `transactionManager.runInTransaction`, which for
 * the consumer is an `ActiveTransactionManager` (the same transaction, the same
 * connection), so each message uses a single connection. The writes keep the
 * `tx` they receive, as in `OrderPrisma`.
 */
export class OrderInTransactionRepository implements OrderRepository {
  constructor(
    private readonly orderPrisma: OrderPrisma,
    private readonly transactionManager: TransactionManager,
  ) {}

  findById(id: string): Promise<Result<Order>> {
    return this.transactionManager.runInTransaction((tx) => this.orderPrisma.findById(id, tx));
  }

  create(order: Order, tx?: TransactionContext): Promise<Result<void>> {
    return this.orderPrisma.create(order, tx);
  }

  update(order: Order, tx?: TransactionContext): Promise<Result<void>> {
    return this.orderPrisma.update(order, tx);
  }

  delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    return this.orderPrisma.delete(id, tx);
  }
}
