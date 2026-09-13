import {
  Result,
  Text,
  ValueObject,
  ValueObjectConfig,
  resolveVoConfig,
} from '@mentoria-360/shared'
import { CustomerAddressDTO } from '../dto'
import { StateCode } from './state-code.vo'
import { ZipCode } from './zip-code.vo'

export interface CustomerAddressProps {
  zipCode: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
}

// Text limits, applied after trimming.
const CUSTOMER_ADDRESS_LIMITS = {
  street: { min: 2, max: 120 },
  number: { min: 1, max: 10 },
  complement: { max: 80 },
  neighborhood: { min: 2, max: 60 },
  city: { min: 2, max: 60 },
} as const

// The customer's single delivery address. It has no identity of its own: it is
// always replaced as a whole, so two addresses with the same fields are equal.
export class CustomerAddress extends ValueObject<
  CustomerAddressDTO,
  ValueObjectConfig
> {
  private constructor(value: CustomerAddressDTO, config?: ValueObjectConfig) {
    super(Object.freeze({ ...value }), config)
  }

  static create(
    props: CustomerAddressProps,
    config?: ValueObjectConfig,
  ): CustomerAddress {
    const result = CustomerAddress.tryCreate(props, config)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(
    props: CustomerAddressProps,
    config?: ValueObjectConfig,
  ): Result<CustomerAddress> {
    const input: Partial<CustomerAddressProps> = props ?? {}
    const limits = CUSTOMER_ADDRESS_LIMITS

    const zipCode = ZipCode.tryCreate(input.zipCode as string)
    const street = Text.tryCreate(input.street as string, {
      minLength: limits.street.min,
      maxLength: limits.street.max,
    })
    const number = Text.tryCreate(input.number as string, {
      minLength: limits.number.min,
      maxLength: limits.number.max,
    })
    // A missing or blank complement resolves to `null`.
    const complement = Text.tryCreate(input.complement, {
      optional: true,
      maxLength: limits.complement.max,
    })
    const neighborhood = Text.tryCreate(input.neighborhood as string, {
      minLength: limits.neighborhood.min,
      maxLength: limits.neighborhood.max,
    })
    const city = Text.tryCreate(input.city as string, {
      minLength: limits.city.min,
      maxLength: limits.city.max,
    })
    const state = StateCode.tryCreate(input.state as string)

    const attrs = Result.combine([
      zipCode,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new CustomerAddress(
        {
          zipCode: zipCode.instance.value,
          street: street.instance.value,
          number: number.instance.value,
          complement: complement.instance?.value ?? null,
          neighborhood: neighborhood.instance.value,
          city: city.instance.value,
          state: state.instance.value,
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

  equals(other: CustomerAddress): boolean {
    const keys = Object.keys(this.value) as (keyof CustomerAddressDTO)[]
    return keys.every((key) => this.value[key] === other.value[key])
  }

  toDTO(): CustomerAddressDTO {
    return { ...this.value }
  }
}
