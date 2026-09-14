import {
  Alias,
  Entity,
  EntityProps,
  Flag,
  Id,
  Result,
  Text,
} from '@mentoria-360/shared'
import {
  PRODUCT_DEFAULT_UNIT,
  PRODUCT_MAX_IMAGES,
  ProductErrors,
} from '../errors'
import { MoneyCents } from './money-cents.vo'
import { ProductDescription } from './product-description.vo'
import { ProductImage, ProductImageProps } from './product-image.vo'
import { ProductName } from './product-name.vo'

export interface ProductProps extends EntityProps {
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
  isFeatured?: boolean | null
}

// `brandName` and `categoryPath` depend on other aggregates, so they are not
// part of the entity: they are computed by the read side (`ProductDTO`).
export class Product extends Entity<Product, ProductProps> {
  private constructor(props: ProductProps) {
    super(props)
  }

  static create(props: ProductProps): Product {
    const result = Product.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: ProductProps): Result<Product> {
    const id = Id.tryCreate(props.id)
    const name = ProductName.tryCreate(props.name)
    const slug = Alias.tryCreate(Product.resolveSlug(props.slug, props.name))
    const sku = Text.tryCreate(props.sku, { optional: true, maxLength: 40 })
    const brandId = Id.tryCreate(props.brandId, { optional: true })
    // `Id.tryCreate` would generate a uuid for a missing value.
    const categoryId = Id.required(props.categoryId)
    const description = ProductDescription.tryCreate(props.description, {
      optional: true,
    })
    const priceCents = MoneyCents.tryCreate(props.priceCents)
    const listPriceCents = MoneyCents.tryCreate(props.listPriceCents, {
      optional: true,
    })
    const unit = Text.tryCreate(Product.resolveUnit(props.unit), {
      maxLength: 40,
    })
    const isActive = Flag.tryCreate(props.isActive ?? true)
    const isFeatured = Flag.tryCreate(props.isFeatured ?? false)

    const images = (props.images ?? []).map((image) =>
      ProductImage.tryCreate(image),
    )
    const imagesLimit =
      images.length > PRODUCT_MAX_IMAGES
        ? Result.fail(ProductErrors.PRODUCT_IMAGES_LIMIT_EXCEEDED)
        : Result.ok()

    // Only comparable when both prices are valid; otherwise their own errors apply.
    const listPriceGreaterThanPrice =
      priceCents.isOk &&
      listPriceCents.isOk &&
      listPriceCents.instance !== null &&
      listPriceCents.instance.value <= priceCents.instance.value
        ? Result.fail(ProductErrors.PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE)
        : Result.ok()

    const attrs = Result.combine([
      id,
      name,
      slug,
      sku,
      brandId,
      categoryId,
      description,
      priceCents,
      listPriceCents,
      unit,
      isActive,
      isFeatured,
      imagesLimit,
      listPriceGreaterThanPrice,
      ...images,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new Product({
        ...props,
        id: id.instance.value,
        name: name.instance.value,
        slug: slug.instance.value,
        sku: sku.instance?.value ?? null,
        brandId: brandId.instance?.value ?? null,
        categoryId: categoryId.instance.value,
        description: description.instance?.value ?? null,
        priceCents: priceCents.instance.value,
        listPriceCents: listPriceCents.instance?.value ?? null,
        unit: unit.instance.value,
        images: Product.normalizeImages(images.map((image) => image.instance)),
        isActive: isActive.instance.value,
        isFeatured: isFeatured.instance.value,
      }),
    )
  }

  // A missing or blank slug is derived from the name. `Alias` lowercases the
  // value before validating it, so lowercasing here yields exactly what is stored.
  static resolveSlug(slug: string | null | undefined, name: string): string {
    if (typeof slug === 'string' && slug.trim()) return slug.toLowerCase()
    return Alias.format(name)
  }

  // A missing or blank unit falls back to the default one.
  static resolveUnit(unit: string | null | undefined): string {
    if (typeof unit === 'string' && unit.trim()) return unit
    return PRODUCT_DEFAULT_UNIT
  }

  // Stable sort by `order` (ties keep their position in the list), then the
  // order is reassigned as `0..n-1`, so the stored sequence has no gaps.
  private static normalizeImages(images: ProductImage[]): ProductImageProps[] {
    return [...images]
      .sort((a, b) => a.order - b.order)
      .map((image, index) => image.withOrder(index).toProps())
  }

  get name(): string {
    return this.props.name
  }

  get slug(): string {
    return this.props.slug!
  }

  get sku(): string | null {
    return this.props.sku ?? null
  }

  get brandId(): string | null {
    return this.props.brandId ?? null
  }

  get categoryId(): string {
    return this.props.categoryId
  }

  get description(): string | null {
    return this.props.description ?? null
  }

  get priceCents(): number {
    return this.props.priceCents
  }

  get listPriceCents(): number | null {
    return this.props.listPriceCents ?? null
  }

  get unit(): string {
    return this.props.unit ?? PRODUCT_DEFAULT_UNIT
  }

  // Copies ordered by `order` (0..n-1), so callers cannot change the entity.
  get images(): ProductImageProps[] {
    return (this.props.images ?? []).map((image) => ({ ...image }))
  }

  // The image with the lowest order, or `null` when the product has none.
  get mainImage(): ProductImageProps | null {
    return this.images[0] ?? null
  }

  get isActive(): boolean {
    return this.props.isActive === true
  }

  // Editorial highlight on the storefront ("Em destaque"); `false` by default.
  get isFeatured(): boolean {
    return this.props.isFeatured === true
  }
}
