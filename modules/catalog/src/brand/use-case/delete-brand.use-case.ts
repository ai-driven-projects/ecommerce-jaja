import { Result, UseCase } from '@mentoria-360/shared'
import { ProductRepository } from '../../product/provider'
import { BrandErrors } from '../errors'
import { BrandRepository } from '../provider'

export interface DeleteBrandInput {
  id: string
}

export class DeleteBrand implements UseCase<DeleteBrandInput, void> {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: DeleteBrandInput): Promise<Result<void>> {
    const brand = await this.brandRepository.findById(input.id)
    if (brand.isFailure) return brand.withFail

    // Deleted products are ignored by the repository, so only live ones block.
    const hasProducts = await this.productRepository.existsByBrandId(
      brand.instance.id,
    )
    if (hasProducts.isFailure) return hasProducts.withFail
    if (hasProducts.instance) return Result.fail(BrandErrors.BRAND_HAS_PRODUCTS)

    // The soft delete (filling `deletedAt`) is the repository's responsibility.
    return this.brandRepository.delete(brand.instance.id)
  }
}
