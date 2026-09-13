import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Product,
  ProductErrors,
  ProductRepository,
} from '../../src/product'

export class InMemoryProductRepository implements ProductRepository {
  private readonly items = new Map<string, Product>()

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  // Test-only access to the stored record, soft-deleted ones included.
  findStored(id: string): Product | undefined {
    return this.items.get(id)
  }

  async create(
    entity: Product,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    // Mirrors the database constraints, which also cover soft-deleted records.
    // A taken primary key maps to PRODUCT_NOT_FOUND, as the Prisma adapter does
    // (e.g. saving with the id of a deleted product).
    if (this.items.has(entity.id)) {
      return Result.fail(ProductErrors.PRODUCT_NOT_FOUND)
    }
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Product,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(ProductErrors.PRODUCT_NOT_FOUND)
    }
    const conflict = this.findConflict(entity)
    if (conflict) return Result.fail(conflict)

    // Storing the new entity replaces the whole image list.
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Product>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(ProductErrors.PRODUCT_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async findBySlug(slug: string): Promise<Result<Product | null>> {
    const entity = this.active().find((product) => product.slug === slug)
    return Result.ok(entity ?? null)
  }

  async findBySku(sku: string): Promise<Result<Product | null>> {
    const entity = this.active().find((product) => product.sku === sku)
    return Result.ok(entity ?? null)
  }

  async existsByBrandId(brandId: string): Promise<Result<boolean>> {
    return Result.ok(this.active().some((product) => product.brandId === brandId))
  }

  async existsByCategoryId(categoryId: string): Promise<Result<boolean>> {
    return Result.ok(
      this.active().some((product) => product.categoryId === categoryId),
    )
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(ProductErrors.PRODUCT_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }

  private active(): Product[] {
    return [...this.items.values()].filter((product) => !product.deletedAt)
  }

  private findConflict(entity: Product): string | null {
    for (const other of this.items.values()) {
      if (other.id === entity.id) continue
      if (other.slug === entity.slug) {
        return ProductErrors.PRODUCT_SLUG_ALREADY_EXISTS
      }
      if (entity.sku !== null && other.sku === entity.sku) {
        return ProductErrors.PRODUCT_SKU_ALREADY_EXISTS
      }
    }
    return null
  }
}
