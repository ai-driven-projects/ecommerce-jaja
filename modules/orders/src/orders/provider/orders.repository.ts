import { CrudRepository } from '@mentoria-360/shared'
import { Orders } from '../model'

export interface OrdersRepository
  extends CrudRepository<Orders> {}
