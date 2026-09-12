import { Result, UseCase } from '@mentoria-360/shared'
import { Customers } from '../model'
import { CustomersRepository } from '../provider'

export interface CreateCustomersInput {
  entity: Customers
}

export class CreateCustomers
  implements UseCase<CreateCustomersInput, void>
{
  constructor(
    private readonly customersRepository: CustomersRepository,
  ) {}

  async execute(input: CreateCustomersInput): Promise<Result<void>> {
    return this.customersRepository.create(input.entity)
  }
}
