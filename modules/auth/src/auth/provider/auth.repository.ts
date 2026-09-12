import { CrudRepository } from '@mentoria-360/shared'
import { Auth } from '../model'

export interface AuthRepository
  extends CrudRepository<Auth> {}
