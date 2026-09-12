import { Result, UseCase } from '@mentoria-360/shared'
import { Catalog } from '../model'
import { CatalogRepository } from '../provider'

export interface CreateCatalogInput {
  entity: Catalog
}

export class CreateCatalog
  implements UseCase<CreateCatalogInput, void>
{
  constructor(
    private readonly catalogRepository: CatalogRepository,
  ) {}

  async execute(input: CreateCatalogInput): Promise<Result<void>> {
    return this.catalogRepository.create(input.entity)
  }
}
