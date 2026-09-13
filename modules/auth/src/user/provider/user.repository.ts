import { CrudRepository, Result } from '@mentoria-360/shared'
import { User } from '../model'

export interface UserRepository extends CrudRepository<User> {
  findByEmail(email: string): Promise<Result<User | null>>
}
