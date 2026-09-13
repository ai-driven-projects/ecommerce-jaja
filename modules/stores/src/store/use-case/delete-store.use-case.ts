import { Result, UseCase } from '@mentoria-360/shared'
import { StoreRepository } from '../provider'

export interface DeleteStoreInput {
  id: string
}

export class DeleteStore implements UseCase<DeleteStoreInput, void> {
  constructor(private readonly storeRepository: StoreRepository) {}

  async execute(input: DeleteStoreInput): Promise<Result<void>> {
    const store = await this.storeRepository.findById(input.id)
    if (store.isFailure) return store.withFail

    // The soft delete (filling `deletedAt`) is the repository's responsibility.
    return this.storeRepository.delete(store.instance.id)
  }
}
