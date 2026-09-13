import { Result, TransactionContext } from '@mentoria-360/shared'
import { Store, StoreErrors, StoreRepository } from '../../src/store'

export class InMemoryStoreRepository implements StoreRepository {
  private readonly items = new Map<string, Store>()

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  async create(entity: Store, _tx?: TransactionContext): Promise<Result<void>> {
    // Mirrors the database constraints, which also cover soft-deleted records.
    if (this.items.has(entity.id)) return Result.fail(StoreErrors.STORE_NOT_FOUND)
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(entity: Store, _tx?: TransactionContext): Promise<Result<void>> {
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(StoreErrors.STORE_NOT_FOUND)
    }
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Store>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(StoreErrors.STORE_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async findBySlug(slug: string): Promise<Result<Store | null>> {
    const entity = this.active().find((store) => store.slug === slug)
    return Result.ok(entity ?? null)
  }

  async findByName(name: string): Promise<Result<Store | null>> {
    const normalized = name.trim().toLowerCase()
    const entity = this.active().find(
      (store) => store.name.toLowerCase() === normalized,
    )
    return Result.ok(entity ?? null)
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(StoreErrors.STORE_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }

  private active(): Store[] {
    return [...this.items.values()].filter((store) => !store.deletedAt)
  }

  // The name is unique ignoring case; both keys stay reserved after deletion.
  private findConflict(entity: Store): string | null {
    const name = entity.name.toLowerCase()
    for (const other of this.items.values()) {
      if (other.id === entity.id) continue
      if (other.name.toLowerCase() === name) {
        return StoreErrors.STORE_NAME_ALREADY_EXISTS
      }
      if (other.slug === entity.slug) {
        return StoreErrors.STORE_SLUG_ALREADY_EXISTS
      }
    }
    return null
  }
}
