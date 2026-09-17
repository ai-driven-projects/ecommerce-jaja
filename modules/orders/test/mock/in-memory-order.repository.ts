import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Order,
  OrderErrors,
  OrderProps,
  OrderRepository,
} from '../../src/order'

// One write received by the repository, with the transaction it used.
export interface InMemoryOrderWrite {
  operation: 'create' | 'update' | 'delete'
  id: string
  tx?: TransactionContext
}

// Keeps each order as a stored record (its props, with the dates of every
// step) and rehydrates it on every read, like the database adapter: a read
// returns a new instance, with the step dates and without pending events.
export class InMemoryOrderRepository implements OrderRepository {
  private readonly items = new Map<string, OrderProps>()
  // Every write call, in order, the failed ones included.
  readonly writes: InMemoryOrderWrite[] = []

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  // Test-only access to the stored record, soft-deleted ones included.
  findStored(id: string): Order | undefined {
    const record = this.items.get(id)
    return record ? Order.create(record) : undefined
  }

  // Test-only access to every stored record, in the order of creation.
  stored(): Order[] {
    return [...this.items.values()].map((record) => Order.create(record))
  }

  async create(entity: Order, tx?: TransactionContext): Promise<Result<void>> {
    this.writes.push({ operation: 'create', id: entity.id, tx })
    // Mirrors the primary key, which also covers soft-deleted records.
    if (this.items.has(entity.id)) {
      return Result.fail(OrderErrors.ORDER_ALREADY_EXISTS)
    }

    this.items.set(entity.id, toRecord(entity))
    return Result.ok()
  }

  // Replaces the stored order: status, step dates and `updatedAt` included.
  async update(entity: Order, tx?: TransactionContext): Promise<Result<void>> {
    this.writes.push({ operation: 'update', id: entity.id, tx })
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(OrderErrors.ORDER_NOT_FOUND)
    }

    this.items.set(entity.id, toRecord(entity))
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Order>> {
    const record = this.items.get(id)
    if (!record || record.deletedAt) {
      return Result.fail(OrderErrors.ORDER_NOT_FOUND)
    }
    return Order.tryCreate(record)
  }

  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    this.writes.push({ operation: 'delete', id, tx })
    const record = this.items.get(id)
    if (!record || record.deletedAt) {
      return Result.fail(OrderErrors.ORDER_NOT_FOUND)
    }

    const deleted = Order.create(record).cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, toRecord(deleted.instance))
    return Result.ok()
  }
}

// The stored fields of the order; the totals are computed again on reading.
function toRecord(order: Order): OrderProps {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    items: order.items.map((item) => item.toProps()),
    deliveryAddress: order.deliveryAddress.toDTO(),
    recipientName: order.recipientName,
    deliveryInstructions: order.deliveryInstructions,
    placedAt: order.placedAt,
    paymentApprovedAt: order.paymentApprovedAt,
    pickingStartedAt: order.pickingStartedAt,
    outForDeliveryAt: order.outForDeliveryAt,
    deliveredAt: order.deliveredAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    deletedAt: order.deletedAt,
  }
}
