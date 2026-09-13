import { Id, Result, UseCase } from '@mentoria-360/shared'
import { CATEGORY_MAX_DEPTH, CategoryErrors } from '../errors'
import { Category } from '../model'
import { CategoryRepository } from '../provider'

export interface SaveCategoryInput {
  id?: string
  name: string
  slug?: string | null
  description?: string | null
  parentId?: string | null
  order?: number | null
  isHighlighted?: boolean | null
  imageUrl?: string | null
  isActive?: boolean | null
}

export interface SaveCategoryOutput {
  id: string
}

// Extra hops allowed beyond the maximum depth when walking up the hierarchy,
// so a loop stored by corrupted data can never make the walk spin forever.
const SAFETY_HOPS = 3

/**
 * Creates or updates a category (upsert by id). Checks, in order: current
 * state, parent existence, cycle (update only), depth including the subtree,
 * and slug uniqueness. On update `undefined` keeps the current value and
 * `null` clears `parentId`, `description` and `imageUrl`.
 */
export class SaveCategory
  implements UseCase<SaveCategoryInput, SaveCategoryOutput>
{
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: SaveCategoryInput): Promise<Result<SaveCategoryOutput>> {
    // 1. Current state: an unknown id means creation with that id.
    const current = await this.findCurrent(input.id)
    if (current.isFailure) return current.withFail
    const { id, existing } = current.instance

    // 2. Effective values.
    const name =
      existing && input.name === undefined
        ? existing.name
        : normalizeName(input.name)
    const requestedParentId =
      existing && input.parentId === undefined
        ? existing.parentId
        : (clearable(input.parentId) ?? null)

    // 3. The parent must exist and not be deleted.
    const parent = await this.findParent(requestedParentId)
    if (parent.isFailure) return parent.withFail
    const parentId = parent.instance?.id ?? null

    const ancestors = await this.loadAncestors(parent.instance)
    if (ancestors.isFailure) return ancestors.withFail

    // 4. Cycle, checked before depth so it is the reported error.
    if (existing) {
      const isCycle = ancestors.instance.some(
        (ancestor) => ancestor.id === existing.id,
      )
      if (isCycle) return Result.fail(CategoryErrors.CATEGORY_CYCLE)
    }

    // 5. Depth, including the subtree of an existing category.
    const depth = await this.ensureDepth(existing, ancestors.instance.length)
    if (depth.isFailure) return depth.withFail

    // 6. Slug: an omitted slug keeps the current one on update, so renaming
    // never breaks public URLs; on creation it is derived from the name.
    const slug =
      existing && isBlank(input.slug)
        ? existing.slug
        : Category.resolveSlug(input.slug, name)

    const slugAvailable = await this.ensureSlugAvailable(slug, id)
    if (slugAvailable.isFailure) return slugAvailable.withFail

    // 7. Build and persist.
    return existing
      ? this.update(existing, input, { name, slug, parentId })
      : this.create(id, input, { name, slug, parentId })
  }

  private async create(
    id: string,
    input: SaveCategoryInput,
    values: EffectiveValues,
  ): Promise<Result<SaveCategoryOutput>> {
    const category = Category.tryCreate({
      id,
      ...values,
      description: input.description,
      order: input.order,
      isHighlighted: input.isHighlighted,
      imageUrl: input.imageUrl,
      isActive: input.isActive,
    })
    if (category.isFailure) return category.withFail

    const created = await this.categoryRepository.create(category.instance)
    if (created.isFailure) return created.withFail

    return Result.ok({ id: category.instance.id })
  }

  private async update(
    current: Category,
    input: SaveCategoryInput,
    values: EffectiveValues,
  ): Promise<Result<SaveCategoryOutput>> {
    // `cloneWith` ignores `undefined`, which keeps the current value.
    const category = current.cloneWith({
      ...values,
      description: clearable(input.description),
      order: input.order ?? undefined,
      isHighlighted: input.isHighlighted ?? undefined,
      imageUrl: clearable(input.imageUrl),
      isActive: input.isActive ?? undefined,
      updatedAt: new Date(),
    })
    if (category.isFailure) return category.withFail

    const updated = await this.categoryRepository.update(category.instance)
    if (updated.isFailure) return updated.withFail

    return Result.ok({ id: category.instance.id })
  }

  private async findCurrent(
    rawId: string | undefined,
  ): Promise<Result<{ id: string; existing: Category | null }>> {
    if (!rawId) return Result.ok({ id: Id.createUUID(), existing: null })

    // Rejects a malformed id before it reaches the repository lookup.
    const id = Id.tryCreate(rawId)
    if (id.isFailure) return id.withFail

    const found = await this.categoryRepository.findById(id.instance.value)
    if (found.isOk) return Result.ok({ id: found.instance.id, existing: found.instance })

    // Only a real "not found" turns into a creation; any other failure is propagated.
    if (isNotFound(found)) return Result.ok({ id: id.instance.value, existing: null })
    return found.withFail
  }

  private async findParent(
    parentId: string | null,
  ): Promise<Result<Category | null>> {
    if (!parentId) return Result.ok<Category | null>(null)

    const id = Id.tryCreate(parentId)
    if (id.isFailure) return id.withFail

    const found = await this.categoryRepository.findById(id.instance.value)
    if (found.isOk) return found
    if (isNotFound(found)) {
      return Result.fail(CategoryErrors.PARENT_CATEGORY_NOT_FOUND)
    }
    return found.withFail
  }

  // The parent followed by its ancestors up to the root, so its length is the
  // parent level (0 without a parent). A missing ancestor ends the chain.
  private async loadAncestors(
    parent: Category | null,
  ): Promise<Result<Category[]>> {
    if (!parent) return Result.ok<Category[]>([])

    const chain: Category[] = [parent]
    let nextId = parent.parentId
    while (nextId && chain.length < CATEGORY_MAX_DEPTH + SAFETY_HOPS) {
      const found = await this.categoryRepository.findById(nextId)
      if (found.isFailure) {
        if (isNotFound(found)) break
        return found.withFail
      }
      chain.push(found.instance)
      nextId = found.instance.parentId
    }
    return Result.ok(chain)
  }

  private async ensureDepth(
    existing: Category | null,
    parentLevel: number,
  ): Promise<Result<void>> {
    let height = 1
    // A new category is always a leaf; the subtree only matters on update,
    // and is skipped when the category alone already does not fit.
    if (existing && parentLevel < CATEGORY_MAX_DEPTH) {
      const subtree = await this.subtreeHeight(
        existing.id,
        CATEGORY_MAX_DEPTH - parentLevel,
      )
      if (subtree.isFailure) return subtree.withFail
      height = subtree.instance
    }

    if (parentLevel + height > CATEGORY_MAX_DEPTH) {
      return Result.fail(CategoryErrors.CATEGORY_MAX_DEPTH_EXCEEDED)
    }
    return Result.ok()
  }

  // Height of the subtree rooted at `categoryId` (a leaf counts 1), capped at
  // `limit + 1`: going one level past the limit is enough to know it does not
  // fit, and it bounds the recursion even if the stored hierarchy has a loop.
  private async subtreeHeight(
    categoryId: string,
    limit: number,
  ): Promise<Result<number>> {
    const children = await this.categoryRepository.findByParentId(categoryId)
    if (children.isFailure) return children.withFail
    if (children.instance.length === 0) return Result.ok(1)
    if (limit <= 1) return Result.ok(2)

    let height = 1
    for (const child of children.instance) {
      const childHeight = await this.subtreeHeight(child.id, limit - 1)
      if (childHeight.isFailure) return childHeight.withFail
      height = Math.max(height, childHeight.instance + 1)
      if (height > limit) break
    }
    return Result.ok(height)
  }

  private async ensureSlugAvailable(
    slug: string,
    categoryId: string,
  ): Promise<Result<void>> {
    const found = await this.categoryRepository.findBySlug(slug)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== categoryId) {
      return Result.fail(CategoryErrors.CATEGORY_SLUG_ALREADY_EXISTS)
    }
    return Result.ok()
  }
}

interface EffectiveValues {
  name: string
  slug: string
  parentId: string | null
}

function isNotFound(result: Result<unknown>): boolean {
  return result.errors.includes(CategoryErrors.CATEGORY_NOT_FOUND)
}

// Non-string names become empty so lookups find nothing and `Name` rejects them.
function normalizeName(name: unknown): string {
  return typeof name === 'string' ? name.trim() : ''
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim() === ''
}

// `undefined` keeps the current value; `null` or `''` clears it.
function clearable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  return value || null
}
