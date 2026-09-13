import { CrudRepository, Result } from '@mentoria-360/shared'
import { Store } from '../model'

// Soft-deleted stores (`deletedAt` set) are never returned by any lookup.
// `findById` fails with `StoreErrors.STORE_NOT_FOUND` when the store is missing
// or deleted, and `delete` only fills `deletedAt`, keeping the record.
export interface StoreRepository extends CrudRepository<Store> {
  findBySlug(slug: string): Promise<Result<Store | null>>
  // Case-insensitive match on the trimmed name.
  findByName(name: string): Promise<Result<Store | null>>
}
