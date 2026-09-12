import { Result, UseCase } from '@mentoria-360/shared'
import { Stores } from '../model'
import { StoresRepository } from '../provider'

export interface CreateStoresInput {
  entity: Stores
}

export class CreateStores
  implements UseCase<CreateStoresInput, void>
{
  constructor(
    private readonly storesRepository: StoresRepository,
  ) {}

  async execute(input: CreateStoresInput): Promise<Result<void>> {
    return this.storesRepository.create(input.entity)
  }
}
