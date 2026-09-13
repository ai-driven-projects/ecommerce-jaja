import { Result, TransactionContext } from '@mentoria-360/shared'
import { Brand, BrandErrors, BrandRepository } from '../../src/brand'

export class InMemoryBrandRepository implements BrandRepository {
  private readonly items = new Map<string, Brand>()

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  async create(entity: Brand, _tx?: TransactionContext): Promise<Result<void>> {
    // Mirrors the database constraints, which also cover soft-deleted records.
    if (this.items.has(entity.id)) return Result.fail(BrandErrors.BRAND_NOT_FOUND)
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(entity: Brand, _tx?: TransactionContext): Promise<Result<void>> {
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(BrandErrors.BRAND_NOT_FOUND)
    }
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Brand>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(BrandErrors.BRAND_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async findBySlug(slug: string): Promise<Result<Brand | null>> {
    const entity = this.active().find((brand) => brand.slug === slug)
    return Result.ok(entity ?? null)
  }

  async findByName(name: string): Promise<Result<Brand | null>> {
    const normalized = name.trim().toLowerCase()
    const entity = this.active().find(
      (brand) => brand.name.toLowerCase() === normalized,
    )
    return Result.ok(entity ?? null)
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(BrandErrors.BRAND_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }

  private active(): Brand[] {
    return [...this.items.values()].filter((brand) => !brand.deletedAt)
  }

  private findConflict(entity: Brand): string | null {
    for (const other of this.items.values()) {
      if (other.id === entity.id) continue
      if (other.name === entity.name) return BrandErrors.BRAND_NAME_ALREADY_EXISTS
      if (other.slug === entity.slug) return BrandErrors.BRAND_SLUG_ALREADY_EXISTS
    }
    return null
  }
}
