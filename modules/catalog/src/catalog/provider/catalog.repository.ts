import { CrudRepository } from '@mentoria-360/shared'
import { Catalog } from '../model'

export interface CatalogRepository
  extends CrudRepository<Catalog> {}
