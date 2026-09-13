import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Customer,
  CustomerErrors,
  CustomerRepository,
} from '../../src/customer'

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly items = new Map<string, Customer>()

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  async create(
    entity: Customer,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    // Mirrors the database constraints, which also cover soft-deleted records.
    if (this.items.has(entity.id)) {
      return Result.fail(CustomerErrors.CUSTOMER_NOT_FOUND)
    }
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Customer,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(CustomerErrors.CUSTOMER_NOT_FOUND)
    }
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Customer>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(CustomerErrors.CUSTOMER_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async findByUserId(userId: string): Promise<Result<Customer | null>> {
    const entity = this.active().find((customer) => customer.userId === userId)
    return Result.ok(entity ?? null)
  }

  async findByCpf(cpf: string): Promise<Result<Customer | null>> {
    const entity = this.active().find((customer) => customer.cpf === cpf)
    return Result.ok(entity ?? null)
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(CustomerErrors.CUSTOMER_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }

  private active(): Customer[] {
    return [...this.items.values()].filter((customer) => !customer.deletedAt)
  }

  // Unique `userId` and `cpf`, checked against every record, deleted ones included.
  private findConflict(entity: Customer): string | null {
    for (const other of this.items.values()) {
      if (other.id === entity.id) continue
      if (other.userId === entity.userId) {
        return CustomerErrors.CUSTOMER_ALREADY_EXISTS
      }
      if (other.cpf === entity.cpf) {
        return CustomerErrors.CUSTOMER_CPF_ALREADY_EXISTS
      }
    }
    return null
  }
}
