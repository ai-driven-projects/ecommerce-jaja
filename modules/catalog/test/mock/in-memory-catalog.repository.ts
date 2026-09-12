import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Catalog,
  CatalogRepository,
} from '../../../src/catalog'

export class InMemoryCatalogRepository
  implements CatalogRepository
{
  private readonly items = new Map<string, Catalog>()

  async create(
    entity: Catalog,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Catalog,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Catalog>> {
    const entity = this.items.get(id)

    if (!entity) {
      return Result.fail('ENTITY_NOT_FOUND')
    }

    return Result.ok(entity)
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    this.items.delete(id)
    return Result.ok()
  }
}
