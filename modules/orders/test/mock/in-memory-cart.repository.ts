import { Result, TransactionContext } from '@mentoria-360/shared'
import { Cart, CartErrors, CartRepository } from '../../src/cart'

export class InMemoryCartRepository implements CartRepository {
  private readonly items = new Map<string, Cart>()

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  // Test-only access to the stored record, soft-deleted ones included.
  findStored(id: string): Cart | undefined {
    return this.items.get(id)
  }

  async create(entity: Cart, _tx?: TransactionContext): Promise<Result<void>> {
    // Mirrors the database constraints, which also cover soft-deleted records.
    // A taken primary key maps to CART_NOT_FOUND, as the Prisma adapter does.
    if (this.items.has(entity.id)) {
      return Result.fail(CartErrors.CART_NOT_FOUND)
    }
    if (this.hasUserConflict(entity)) {
      return Result.fail(CartErrors.CART_ALREADY_EXISTS)
    }

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(entity: Cart, _tx?: TransactionContext): Promise<Result<void>> {
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(CartErrors.CART_NOT_FOUND)
    }
    if (this.hasUserConflict(entity)) {
      return Result.fail(CartErrors.CART_ALREADY_EXISTS)
    }

    // Storing the new entity replaces the whole item list.
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Cart>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(CartErrors.CART_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async findByUserId(userId: string): Promise<Result<Cart | null>> {
    const entity = this.active().find((cart) => cart.userId === userId)
    return Result.ok(entity ?? null)
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(CartErrors.CART_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }

  private active(): Cart[] {
    return [...this.items.values()].filter((cart) => !cart.deletedAt)
  }

  // Unique `userId`, checked against every record, deleted ones included.
  private hasUserConflict(entity: Cart): boolean {
    for (const other of this.items.values()) {
      if (other.id !== entity.id && other.userId === entity.userId) return true
    }
    return false
  }
}
