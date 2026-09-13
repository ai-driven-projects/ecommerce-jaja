import { Result, UseCase } from '@mentoria-360/shared'
import { ProductRepository } from '../../product/provider'
import { CategoryErrors } from '../errors'
import { CategoryRepository } from '../provider'

export interface DeleteCategoryInput {
  id: string
}

export class DeleteCategory implements UseCase<DeleteCategoryInput, void> {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(input: DeleteCategoryInput): Promise<Result<void>> {
    const category = await this.categoryRepository.findById(input.id)
    if (category.isFailure) return category.withFail

    // Deleted children are ignored by the repository, so only live ones block.
    const children = await this.categoryRepository.findByParentId(
      category.instance.id,
    )
    if (children.isFailure) return children.withFail
    if (children.instance.length > 0) {
      return Result.fail(CategoryErrors.CATEGORY_HAS_CHILDREN)
    }

    // Only direct links count: the children check already protects the
    // categories above a product. Deleted products do not block.
    const hasProducts = await this.productRepository.existsByCategoryId(
      category.instance.id,
    )
    if (hasProducts.isFailure) return hasProducts.withFail
    if (hasProducts.instance) {
      return Result.fail(CategoryErrors.CATEGORY_HAS_PRODUCTS)
    }

    // The soft delete (filling `deletedAt`) is the repository's responsibility.
    return this.categoryRepository.delete(category.instance.id)
  }
}
