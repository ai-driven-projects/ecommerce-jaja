import { CrudRepository } from '@mentoria-360/shared'
import { Customers } from '../model'

export interface CustomersRepository
  extends CrudRepository<Customers> {}
