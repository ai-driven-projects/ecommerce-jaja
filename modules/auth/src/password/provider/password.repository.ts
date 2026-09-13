import { Result, TransactionContext } from '@mentoria-360/shared'
import { Password } from '../model'

export interface PasswordRepository {
  create(password: Password, tx?: TransactionContext): Promise<Result<void>>
  findByUserId(userId: string): Promise<Result<Password | null>>
}
