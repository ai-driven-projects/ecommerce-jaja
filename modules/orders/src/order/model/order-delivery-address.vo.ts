import {
  Result,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { OrderDeliveryAddressDTO } from '../dto'
import { OrderErrors } from '../errors'

export interface OrderDeliveryAddressProps {
  zipCode: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
}

// Copy of the customer's address made when the order is placed, so it never
// changes when the customer edits their record later. The fine rules (text
// limits, the list of states, the CEP mask) belong to the customer record: here
// the copy only has to be complete. Any blank required field or malformed
// format fails with a single `ORDER_DELIVERY_ADDRESS_INVALID`.
export class OrderDeliveryAddress extends ValueObject<
  OrderDeliveryAddressDTO,
  ValueObjectConfig
> {
  // 8 digits, as the customer record stores the CEP.
  private static readonly ZIP_CODE_PATTERN: RegExp = /^\d{8}$/
  // Two uppercase letters, as the customer record stores the state.
  private static readonly STATE_PATTERN: RegExp = /^[A-Z]{2}$/

  private constructor(
    value: OrderDeliveryAddressDTO,
    config?: ValueObjectConfig,
  ) {
    super(Object.freeze({ ...value }), config)
  }

  static create(
    props: OrderDeliveryAddressProps,
    config?: ValueObjectConfig,
  ): OrderDeliveryAddress {
    const result = OrderDeliveryAddress.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: OrderDeliveryAddressProps,
    config?: ValueObjectConfig,
  ): Result<OrderDeliveryAddress> {
    const input: Partial<OrderDeliveryAddressProps> = props ?? {}

    const zipCode = trimmed(input.zipCode)
    const street = trimmed(input.street)
    const number = trimmed(input.number)
    const neighborhood = trimmed(input.neighborhood)
    const city = trimmed(input.city)
    const state = trimmed(input.state)
    const complement = input.complement == null ? '' : trimmed(input.complement)

    const valid =
      OrderDeliveryAddress.ZIP_CODE_PATTERN.test(zipCode ?? '') &&
      OrderDeliveryAddress.STATE_PATTERN.test(state ?? '') &&
      !!street &&
      !!number &&
      !!neighborhood &&
      !!city &&
      complement !== null
    if (!valid) return Result.fail(OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID)

    return Result.ok(
      new OrderDeliveryAddress(
        {
          zipCode: zipCode!,
          street: street!,
          number: number!,
          // A missing or blank complement resolves to `null`.
          complement: complement || null,
          neighborhood: neighborhood!,
          city: city!,
          state: state!,
        },
        resolveVoConfig(config),
      ),
    )
  }

  get zipCode(): string {
    return this.value.zipCode
  }

  get street(): string {
    return this.value.street
  }

  get number(): string {
    return this.value.number
  }

  get complement(): string | null {
    return this.value.complement
  }

  get neighborhood(): string {
    return this.value.neighborhood
  }

  get city(): string {
    return this.value.city
  }

  get state(): string {
    return this.value.state
  }

  equals(other: OrderDeliveryAddress): boolean {
    const keys = Object.keys(this.value) as (keyof OrderDeliveryAddressDTO)[]
    return keys.every((key) => this.value[key] === other.value[key])
  }

  toDTO(): OrderDeliveryAddressDTO {
    return { ...this.value }
  }
}

// The trimmed text, or `null` when the value is not a string.
function trimmed(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null
}
