import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Auth,
  AuthRepository,
} from '../../../src/auth'

export class InMemoryAuthRepository
  implements AuthRepository
{
  private readonly items = new Map<string, Auth>()

  async create(
    entity: Auth,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Auth,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Auth>> {
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
