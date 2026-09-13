import { Result, TransactionContext } from '@mentoria-360/shared'
import { User, UserRepository } from '../../src/user'

export class InMemoryUserRepository implements UserRepository {
  private readonly items = new Map<string, User>()

  get size(): number {
    return this.items.size
  }

  async create(entity: User, _tx?: TransactionContext): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async update(entity: User, _tx?: TransactionContext): Promise<Result<void>> {
    this.items.set(entity.id, entity)
    return Result.ok()
  }

  async findById(id: string): Promise<Result<User>> {
    const entity = this.items.get(id)
    if (!entity) return Result.fail('ENTITY_NOT_FOUND')
    return Result.ok(entity)
  }

  async findByEmail(email: string): Promise<Result<User | null>> {
    const normalized = email.trim().toLowerCase()
    for (const entity of this.items.values()) {
      if (entity.email === normalized) return Result.ok(entity)
    }
    return Result.ok(null)
  }

  async delete(id: string, _tx?: TransactionContext): Promise<Result<void>> {
    this.items.delete(id)
    return Result.ok()
  }
}
