import {
  Order,
  Result,
  Url,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'

export interface ProductImageProps {
  thumbUrl: string
  largeUrl: string
  order: number
}

// An image has no identity of its own: the product list is always replaced as
// a whole, so two images with the same URLs and order are the same image.
export class ProductImage extends ValueObject<
  ProductImageProps,
  ValueObjectConfig
> {
  private constructor(value: ProductImageProps, config?: ValueObjectConfig) {
    super(Object.freeze({ ...value }), config)
  }

  static create(
    props: ProductImageProps,
    config?: ValueObjectConfig,
  ): ProductImage {
    const result = ProductImage.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: ProductImageProps,
    config?: ValueObjectConfig,
  ): Result<ProductImage> {
    const input: Partial<ProductImageProps> = props ?? {}
    const thumbUrl = Url.tryCreate(input.thumbUrl as string)
    const largeUrl = Url.tryCreate(input.largeUrl as string)
    const order = Order.tryCreate(input.order as number)

    const attrs = Result.combine([thumbUrl, largeUrl, order])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new ProductImage(
        {
          thumbUrl: thumbUrl.instance.value,
          largeUrl: largeUrl.instance.value,
          order: order.instance.value,
        },
        resolveVoConfig(config),
      ),
    )
  }

  get thumbUrl(): string {
    return this.value.thumbUrl
  }

  get largeUrl(): string {
    return this.value.largeUrl
  }

  get order(): number {
    return this.value.order
  }

  // New instance with the same URLs in another position; throws on an invalid order.
  withOrder(order: number): ProductImage {
    return ProductImage.create({ ...this.value, order }, this.config)
  }

  equals(other: ProductImage): boolean {
    return (
      this.thumbUrl === other.thumbUrl &&
      this.largeUrl === other.largeUrl &&
      this.order === other.order
    )
  }

  toProps(): ProductImageProps {
    return { ...this.value }
  }
}
