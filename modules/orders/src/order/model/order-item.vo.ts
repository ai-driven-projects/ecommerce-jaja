import {
  Id,
  Result,
  Text,
  Url,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { CART_ITEM_MAX_QUANTITY } from '../../cart'
import { OrderItemDTO } from '../dto'
import { OrderErrors } from '../errors'

export interface OrderItemProps {
  productId: string
  name: string
  unit: string
  thumbUrl?: string | null
  unitPriceCents: number
  quantity: number
}

// Text limits, applied after trimming.
const ORDER_ITEM_LIMITS = {
  name: { min: 1, max: 255 },
  unit: { min: 1, max: 40 },
} as const

// One line of the order, frozen when the order is placed: the product data and
// the unit price are copies and never follow later catalog changes. An item has
// no identity of its own: the list is created as a whole with the order.
export class OrderItem extends ValueObject<OrderItemProps, ValueObjectConfig> {
  private constructor(value: OrderItemProps, config?: ValueObjectConfig) {
    super(Object.freeze({ ...value }), config)
  }

  static create(props: OrderItemProps, config?: ValueObjectConfig): OrderItem {
    const result = OrderItem.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: OrderItemProps,
    config?: ValueObjectConfig,
  ): Result<OrderItem> {
    const input: Partial<OrderItemProps> = props ?? {}
    const limits = ORDER_ITEM_LIMITS

    // `Id.required` fails for a missing value instead of generating a uuid.
    const productId = Id.required(
      typeof input.productId === 'string' ? input.productId : '',
    )
    const name = Text.tryCreate(input.name as string, {
      minLength: limits.name.min,
      maxLength: limits.name.max,
    })
    const unit = Text.tryCreate(input.unit as string, {
      minLength: limits.unit.min,
      maxLength: limits.unit.max,
    })
    // A missing or blank thumbnail resolves to `null`.
    const thumbUrl = Url.tryCreate(input.thumbUrl, { optional: true })
    const unitPriceCents = OrderItem.isValidUnitPrice(input.unitPriceCents)
      ? Result.ok()
      : Result.fail(OrderErrors.ORDER_ITEM_PRICE_INVALID)
    const quantity = OrderItem.isValidQuantity(input.quantity)
      ? Result.ok()
      : Result.fail(OrderErrors.ORDER_ITEM_QUANTITY_INVALID)

    const attrs = Result.combine([
      productId,
      name,
      unit,
      thumbUrl,
      unitPriceCents,
      quantity,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new OrderItem(
        {
          productId: productId.instance.value,
          name: name.instance.value,
          unit: unit.instance.value,
          thumbUrl: thumbUrl.instance?.value ?? null,
          unitPriceCents: input.unitPriceCents as number,
          quantity: input.quantity as number,
        },
        resolveVoConfig(config),
      ),
    )
  }

  // An integer of at least 1 cent; anything else (0, 1.5, text, missing) is
  // invalid.
  static isValidUnitPrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1
  }

  // An integer from 1 to `CART_ITEM_MAX_QUANTITY`, the same limit of the cart.
  static isValidQuantity(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= CART_ITEM_MAX_QUANTITY
    )
  }

  // Lowercase uuid.
  get productId(): string {
    return this.value.productId
  }

  get name(): string {
    return this.value.name
  }

  get unit(): string {
    return this.value.unit
  }

  get thumbUrl(): string | null {
    return this.value.thumbUrl ?? null
  }

  get unitPriceCents(): number {
    return this.value.unitPriceCents
  }

  get quantity(): number {
    return this.value.quantity
  }

  // `unitPriceCents * quantity`.
  get lineTotalCents(): number {
    return this.unitPriceCents * this.quantity
  }

  equals(other: OrderItem): boolean {
    const keys = Object.keys(this.value) as (keyof OrderItemProps)[]
    return keys.every((key) => this.value[key] === other.value[key])
  }

  toProps(): OrderItemProps {
    return { ...this.value }
  }

  toDTO(): OrderItemDTO {
    return {
      productId: this.productId,
      name: this.name,
      unit: this.unit,
      thumbUrl: this.thumbUrl,
      unitPriceCents: this.unitPriceCents,
      quantity: this.quantity,
      lineTotalCents: this.lineTotalCents,
    }
  }
}
