import { CrudRepository } from '@mentoria-360/shared'
import { Stores } from '../model'

export interface StoresRepository
  extends CrudRepository<Stores> {}
