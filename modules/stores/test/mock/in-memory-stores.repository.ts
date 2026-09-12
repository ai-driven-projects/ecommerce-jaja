import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Stores,
  StoresRepository,
} from '../../../src/stores'

export class InMemoryStoresRepository
  implements StoresRepository
{
  private readonly items = new Map<string, Stores>()

  async create(
    entity: Stores,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Stores,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Stores>> {
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
