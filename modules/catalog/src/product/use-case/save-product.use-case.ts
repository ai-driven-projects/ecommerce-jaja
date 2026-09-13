import { Id, Result, UseCase } from '@mentoria-360/shared'
import { BrandRepository } from '../../brand/provider'
import { CategoryRepository } from '../../category/provider'
import { ProductErrors } from '../errors'
import { Product, ProductImageProps } from '../model'
import { ProductRepository } from '../provider'

export interface SaveProductInput {
  id?: string
  name: string
  slug?: string | null
  sku?: string | null
  brandId?: string | null
  categoryId: string
  description?: string | null
  priceCents: number
  listPriceCents?: number | null
  unit?: string | null
  images?: ProductImageProps[] | null
  isActive?: boolean | null
}

/**
 * Creates or updates a product (upsert by id). Checks, in order: current
 * state, attributes (entity), brand, category, slug and sku uniqueness.
 *
 * - An unknown id means creation with that id; a missing id generates a uuid v4.
 * - On update `undefined` keeps the current value and `null` (or a blank
 *   string) clears the optional fields; a blank slug keeps the current one, so
 *   renaming never breaks URLs.
 * - `images` always replaces the whole list: omitting it leaves no images.
 */
export class SaveProduct implements UseCase<SaveProductInput, Product> {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly brandRepository: BrandRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(input: SaveProductInput): Promise<Result<Product>> {
    // 1. Current state: an unknown id means creation with that id.
    const current = await this.findCurrent(input.id)
    if (current.isFailure) return current.withFail
    const { id, existing } = current.instance

    // 2. Attributes, validated by the entity before any other lookup.
    const product = existing
      ? this.change(existing, input)
      : this.build(id, input)
    if (product.isFailure) return product.withFail

    // 3. References: the brand (when informed) and the category must exist.
    const brand = await this.ensureBrandExists(product.instance.brandId)
    if (brand.isFailure) return brand.withFail

    const category = await this.categoryRepository.findById(
      product.instance.categoryId,
    )
    if (category.isFailure) return category.withFail

    // 4. Uniqueness, ignoring the product itself.
    const slugAvailable = await this.ensureSlugAvailable(product.instance)
    if (slugAvailable.isFailure) return slugAvailable.withFail

    const skuAvailable = await this.ensureSkuAvailable(product.instance)
    if (skuAvailable.isFailure) return skuAvailable.withFail

    // 5. Persist.
    const saved = existing
      ? await this.productRepository.update(product.instance)
      : await this.productRepository.create(product.instance)
    if (saved.isFailure) return saved.withFail

    return Result.ok(product.instance)
  }

  private build(id: string, input: SaveProductInput): Result<Product> {
    return Product.tryCreate({
      id,
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      brandId: input.brandId,
      categoryId: input.categoryId,
      description: input.description,
      priceCents: input.priceCents,
      listPriceCents: input.listPriceCents,
      unit: input.unit,
      images: input.images ?? [],
      isActive: input.isActive,
    })
  }

  // `cloneWith` ignores `undefined`, which keeps the current value; the entity
  // turns `null` and blank strings into `null` (or the default unit).
  private change(current: Product, input: SaveProductInput): Result<Product> {
    return current.cloneWith({
      name: input.name,
      slug: isBlank(input.slug) ? undefined : input.slug,
      sku: input.sku,
      brandId: input.brandId,
      categoryId: input.categoryId,
      description: input.description,
      priceCents: input.priceCents,
      listPriceCents: input.listPriceCents,
      unit: input.unit,
      images: input.images ?? [],
      isActive: input.isActive ?? undefined,
      updatedAt: new Date(),
    })
  }

  private async findCurrent(
    rawId: string | undefined,
  ): Promise<Result<{ id: string; existing: Product | null }>> {
    if (!rawId) return Result.ok({ id: Id.createUUID(), existing: null })

    // Rejects a malformed id before it reaches the repository lookup.
    const id = Id.tryCreate(rawId)
    if (id.isFailure) return id.withFail

    const found = await this.productRepository.findById(id.instance.value)
    if (found.isOk) {
      return Result.ok({ id: found.instance.id, existing: found.instance })
    }

    // Only a real "not found" turns into a creation; any other failure is propagated.
    if (found.errors.includes(ProductErrors.PRODUCT_NOT_FOUND)) {
      return Result.ok({ id: id.instance.value, existing: null })
    }
    return found.withFail
  }

  // The brand repository fails with `BRAND_NOT_FOUND` for a missing or deleted brand.
  private async ensureBrandExists(brandId: string | null): Promise<Result<void>> {
    if (!brandId) return Result.ok()

    const found = await this.brandRepository.findById(brandId)
    if (found.isFailure) return found.withFail
    return Result.ok()
  }

  private async ensureSlugAvailable(product: Product): Promise<Result<void>> {
    const found = await this.productRepository.findBySlug(product.slug)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== product.id) {
      return Result.fail(ProductErrors.PRODUCT_SLUG_ALREADY_EXISTS)
    }
    return Result.ok()
  }

  private async ensureSkuAvailable(product: Product): Promise<Result<void>> {
    if (product.sku === null) return Result.ok()

    const found = await this.productRepository.findBySku(product.sku)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== product.id) {
      return Result.fail(ProductErrors.PRODUCT_SKU_ALREADY_EXISTS)
    }
    return Result.ok()
  }
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim() === ''
}
