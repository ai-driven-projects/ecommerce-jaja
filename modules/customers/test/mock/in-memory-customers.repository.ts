import { Result, TransactionContext } from '@mentoria-360/shared'
import {
  Customers,
  CustomersRepository,
} from '../../../src/customers'

export class InMemoryCustomersRepository
  implements CustomersRepository
{
  private readonly items = new Map<string, Customers>()

  async create(
    entity: Customers,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(
    entity: Customers,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<Customers>> {
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
