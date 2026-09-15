import { Result, TransactionContext } from '@mentoria-360/shared'
import { Order, OrderErrors, OrderRepository } from '../../src/order'

// One write received by the repository, with the transaction it used.
export interface InMemoryOrderWrite {
  operation: 'create' | 'update' | 'delete'
  id: string
  tx?: TransactionContext
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly items = new Map<string, Order>()
  // Every write call, in order, the failed ones included.
  readonly writes: InMemoryOrderWrite[] = []

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  // Test-only access to the stored record, soft-deleted ones included.
  findStored(id: string): Order | undefined {
    return this.items.get(id)
  }

  // Test-only access to every stored record, in the order of creation.
  stored(): Order[] {
    return [...this.items.values()]
  }

  async create(entity: Order, tx?: TransactionContext): Promise<Result<void>> {
    this.writes.push({ operation: 'create', id: entity.id, tx })
    // Mirrors the primary key, which also covers soft-deleted records.
    if (this.items.has(entity.id)) {
      return Result.fail(OrderErrors.ORDER_ALREADY_EXISTS)
    }

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(entity: Order, tx?: TransactionContext): Promise<Result<void>> {
    this.writes.push({ operation: 'update', id: entity.id, tx })
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(OrderErrors.ORDER_NOT_FOUND)
    }

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Order>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(OrderErrors.ORDER_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    this.writes.push({ operation: 'delete', id, tx })
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(OrderErrors.ORDER_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }
}
