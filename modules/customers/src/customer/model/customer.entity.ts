import {
  Cpf,
  Entity,
  EntityProps,
  Flag,
  Id,
  Phone,
  Result,
} from '@mentoria-360/shared'
import { CustomerAddressDTO, CustomerDTO } from '../dto'
import { CustomerAddress, CustomerAddressProps } from './customer-address.vo'

export interface CustomerProps extends EntityProps {
  userId: string
  cpf: string
  phone: string
  address: CustomerAddressProps
  isActive?: boolean
}

// A customer belongs to exactly one user (`userId`), which never changes after
// creation. Name and email are the user's: the domain only knows the `userId`.
// Rules that depend on the repository (unique `userId` and `cpf`) live in the
// use cases.
export class Customer extends Entity<Customer, CustomerProps> {
  private constructor(props: CustomerProps) {
    super(props)
  }

  static create(props: CustomerProps): Customer {
    const result = Customer.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: CustomerProps): Result<Customer> {
    const id = Id.tryCreate(props.id)
    // `Id.tryCreate` would generate a uuid for a missing value.
    const userId = Id.required(props.userId)
    const cpf = Cpf.tryCreate(props.cpf)
    const phone = Phone.tryCreate(props.phone)
    const address = CustomerAddress.tryCreate(props.address)
    const isActive = Flag.tryCreate(props.isActive ?? true)

    const attrs = Result.combine([id, userId, cpf, phone, address, isActive])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new Customer({
        ...props,
        id: id.instance.value,
        userId: userId.instance.value,
        cpf: cpf.instance.value,
        phone: phone.instance.value,
        address: address.instance.toDTO(),
        isActive: isActive.instance.value,
      }),
    )
  }

  get userId(): string {
    return this.props.userId
  }

  // Only the 11 digits.
  get cpf(): string {
    return this.props.cpf
  }

  // Only the digits.
  get phone(): string {
    return this.props.phone
  }

  // A copy, so callers cannot change the entity. `location` is `null` when the
  // address has no point on the map.
  get address(): CustomerAddressDTO {
    const address = this.props.address
    return {
      ...address,
      complement: address.complement ?? null,
      location: address.location ? { ...address.location } : null,
    }
  }

  get isActive(): boolean {
    return this.props.isActive === true
  }

  toDTO(): CustomerDTO {
    return {
      id: this.id,
      userId: this.userId,
      cpf: this.cpf,
      phone: this.phone,
      address: this.address,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
