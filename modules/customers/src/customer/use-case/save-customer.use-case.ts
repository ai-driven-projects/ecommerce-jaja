import { Cpf, Id, Result, UseCase } from '@mentoria-360/shared'
import { CustomerDTO, CustomerLocationDTO } from '../dto'
import { CustomerErrors } from '../errors'
import {
  Customer,
  CustomerAddressProps,
  CustomerLocationProps,
} from '../model'
import { CustomerRepository } from '../provider'

export interface SaveCustomerInput {
  // Sent by the administration: only updates, never creates.
  id?: string
  // The authenticated user; required (and only used) when `id` is not sent.
  userId?: string
  cpf: string
  phone: string
  // Replaces the whole address. `address.location` follows the preservation
  // rule, so screens without a map do not erase the point:
  // - on creation, missing (`undefined`) or `null` creates without a point;
  // - on update, `undefined` keeps the customer's current point (even when the
  //   text fields change), `null` removes it and an object replaces it.
  address: CustomerAddressProps
  // Only applied when updating by `id`; `undefined` keeps the current value.
  isActive?: boolean
}

// One use case for both actors:
// - without `id` (the user, at checkout), the customer is found by `userId`:
//   created when missing, updated otherwise, and `isActive` is ignored, so a
//   customer never activates or deactivates their own record;
// - with `id` (the administration), the customer is found by `id` and updated,
//   applying `isActive`; `CUSTOMER_NOT_FOUND` is propagated without creating,
//   because every customer is born from its own user.
// The `userId` link never changes after creation.
// The point of the address (`address.location`) follows the preservation rule
// in both paths: on creation, `undefined` or `null` means no point; on update,
// `undefined` keeps the current point, `null` removes it and an object replaces
// it. An invalid point fails with `CUSTOMER_LOCATION_INVALID` without saving.
export class SaveCustomer implements UseCase<SaveCustomerInput, CustomerDTO> {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: SaveCustomerInput): Promise<Result<CustomerDTO>> {
    if (!input.id) return this.saveByUserId(input)

    // Rejects a malformed id before it reaches the repository lookup.
    const id = Id.tryCreate(input.id)
    if (id.isFailure) return id.withFail

    // Includes `CUSTOMER_NOT_FOUND`: the administration never creates customers.
    const existing = await this.customerRepository.findById(id.instance.value)
    if (existing.isFailure) return existing.withFail

    return this.update(existing.instance, input, input.isActive)
  }

  private async saveByUserId(
    input: SaveCustomerInput,
  ): Promise<Result<CustomerDTO>> {
    // `Id.required` fails for a missing value instead of generating a uuid.
    const userId = Id.required(
      typeof input.userId === 'string' ? input.userId : '',
    )
    if (userId.isFailure) return userId.withFail

    const existing = await this.customerRepository.findByUserId(
      userId.instance.value,
    )
    if (existing.isFailure) return existing.withFail

    // `isActive` is ignored in both paths: the user does not change their status.
    if (existing.instance) return this.update(existing.instance, input)
    return this.create(userId.instance.value, input)
  }

  private async create(
    userId: string,
    input: SaveCustomerInput,
  ): Promise<Result<CustomerDTO>> {
    const id = Id.createUUID()

    const cpf = await this.availableCpf(input.cpf, id)
    if (cpf.isFailure) return cpf.withFail

    const customer = Customer.tryCreate({
      id,
      userId,
      cpf: cpf.instance,
      phone: input.phone,
      // Creation has no current point: `undefined` and `null` mean no point.
      address: toAddress(input.address, null),
      isActive: true,
    })
    if (customer.isFailure) return customer.withFail

    const created = await this.customerRepository.create(customer.instance)
    if (created.isFailure) return created.withFail

    return Result.ok(customer.instance.toDTO())
  }

  private async update(
    current: Customer,
    input: SaveCustomerInput,
    isActive?: boolean,
  ): Promise<Result<CustomerDTO>> {
    const cpf = await this.availableCpf(input.cpf, current.id)
    if (cpf.isFailure) return cpf.withFail

    // `cloneWith` ignores `undefined` (keeping the current value), so required
    // fields are sent explicitly and the address is replaced as a whole.
    // `userId` is never sent: the link does not change. The current point is
    // kept when `address.location` is not sent.
    const customer = current.cloneWith({
      cpf: cpf.instance,
      phone: required(input.phone),
      address: toAddress(input.address, current.address.location),
      isActive,
      updatedAt: new Date(),
    })
    if (customer.isFailure) return customer.withFail

    const updated = await this.customerRepository.update(customer.instance)
    if (updated.isFailure) return updated.withFail

    return Result.ok(customer.instance.toDTO())
  }

  // Normalizes the CPF to its 11 digits before checking uniqueness, so a masked
  // and an unmasked CPF collide. An invalid CPF stops the flow. The customer
  // being saved (`customerId`) is ignored.
  private async availableCpf(
    value: string,
    customerId: string,
  ): Promise<Result<string>> {
    const cpf = Cpf.tryCreate(value)
    if (cpf.isFailure) return cpf.withFail

    const found = await this.customerRepository.findByCpf(cpf.instance.value)
    if (found.isFailure) return found.withFail
    if (found.instance && found.instance.id !== customerId) {
      return Result.fail(CustomerErrors.CUSTOMER_CPF_ALREADY_EXISTS)
    }

    return Result.ok(cpf.instance.value)
  }
}

// Every field is sent explicitly, so a missing one fails validation instead of
// keeping the current value; an absent, `null` or `''` complement becomes `null`.
// `location` is resolved by `toLocation` against the `currentLocation`.
function toAddress(
  address: CustomerAddressProps | null | undefined,
  currentLocation: CustomerLocationDTO | null,
): CustomerAddressProps {
  const input: Partial<CustomerAddressProps> = address ?? {}
  return {
    zipCode: required(input.zipCode),
    street: required(input.street),
    number: required(input.number),
    complement: input.complement || null,
    neighborhood: required(input.neighborhood),
    city: required(input.city),
    state: required(input.state),
    location: toLocation(input.location, currentLocation),
  }
}

// Preservation rule of the point: `undefined` keeps `currentLocation` (`null`
// on creation), `null` removes it and an object replaces it. Both coordinates
// are sent explicitly, so a missing one fails validation instead of being
// merged with the current point by `cloneWith`.
function toLocation(
  location: CustomerLocationProps | null | undefined,
  currentLocation: CustomerLocationDTO | null,
): CustomerLocationProps | null {
  if (location === undefined) return currentLocation
  if (location === null) return null
  if (typeof location !== 'object') return location

  const input: Partial<CustomerLocationProps> = location
  return {
    latitude: required(input.latitude),
    longitude: required(input.longitude),
  }
}

// A missing value becomes `null`, which the value objects reject.
function required<T>(value: T | null | undefined): T {
  return (value ?? null) as T
}
