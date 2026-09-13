import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Category,
  CategoryErrors,
  CategoryRepository,
} from '../../src/category'

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly items = new Map<string, Category>()

  // Counts every stored record, soft-deleted ones included.
  get size(): number {
    return this.items.size
  }

  async create(
    entity: Category,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    // Mirrors the database constraints, which also cover soft-deleted records.
    // A taken primary key maps to CATEGORY_NOT_FOUND, as the Prisma adapter does
    // (e.g. saving with the id of a deleted category).
    if (this.items.has(entity.id)) {
      return Result.fail(CategoryErrors.CATEGORY_NOT_FOUND)
    }
    if (this.hasSlugConflict(entity)) {
      return Result.fail(CategoryErrors.CATEGORY_SLUG_ALREADY_EXISTS)
    }

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Category,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    const current = this.items.get(entity.id)
    if (!current || current.deletedAt) {
      return Result.fail(CategoryErrors.CATEGORY_NOT_FOUND)
    }
    if (this.hasSlugConflict(entity)) {
      return Result.fail(CategoryErrors.CATEGORY_SLUG_ALREADY_EXISTS)
    }

    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Category>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(CategoryErrors.CATEGORY_NOT_FOUND)
    }
    return Result.ok(entity)
  }

  async findBySlug(slug: string): Promise<Result<Category | null>> {
    const entity = this.active().find((category) => category.slug === slug)
    return Result.ok(entity ?? null)
  }

  async findByParentId(parentId: string | null): Promise<Result<Category[]>> {
    return Result.ok(
      this.active().filter((category) => category.parentId === parentId),
    )
  }

  async findAll(): Promise<Result<Category[]>> {
    return Result.ok(this.active())
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    const entity = this.items.get(id)
    if (!entity || entity.deletedAt) {
      return Result.fail(CategoryErrors.CATEGORY_NOT_FOUND)
    }

    const deleted = entity.cloneWith({ deletedAt: new Date() })
    if (deleted.isFailure) return deleted.withFail

    this.items.set(id, deleted.instance)
    return Result.ok()
  }

  private active(): Category[] {
    return [...this.items.values()].filter((category) => !category.deletedAt)
  }

  private hasSlugConflict(entity: Category): boolean {
    return [...this.items.values()].some(
      (other) => other.id !== entity.id && other.slug === entity.slug,
    )
  }
}
