import { Result, TransactionContext } from '@mentoria-360/shared'
import { Password, PasswordRepository } from '../../src/password'

export class InMemoryPasswordRepository implements PasswordRepository {
  private readonly items = new Map<string, Password>()

  get size(): number {
    return this.items.size
  }

  async create(
    password: Password,
    _tx?: TransactionContext,
  ): Promise<Result<void>> {
    this.items.set(password.id, password)
    return Result.ok()
  }

  async findByUserId(userId: string): Promise<Result<Password | null>> {
    for (const password of this.items.values()) {
      if (password.userId === userId) return Result.ok(password)
    }
    return Result.ok(null)
  }
}
