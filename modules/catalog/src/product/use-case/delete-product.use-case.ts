import { Result, UseCase } from '@mentoria-360/shared'
import { ProductRepository } from '../provider'

export interface DeleteProductInput {
  id: string
}

export class DeleteProduct implements UseCase<DeleteProductInput, void> {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: DeleteProductInput): Promise<Result<void>> {
    const product = await this.productRepository.findById(input.id)
    if (product.isFailure) return product.withFail

    // The soft delete (filling `deletedAt`) is the repository's responsibility.
    return this.productRepository.delete(product.instance.id)
  }
}
