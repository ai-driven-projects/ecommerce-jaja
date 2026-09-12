import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Orders,
  OrdersRepository,
} from '../../../src/orders'

export class InMemoryOrdersRepository
  implements OrdersRepository
{
  private readonly items = new Map<string, Orders>()

  async create(
    entity: Orders,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Orders,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Orders>> {
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
