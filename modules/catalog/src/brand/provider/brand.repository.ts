import { CrudRepository, Result } from '@mentoria-360/shared'
import { Brand } from '../model'

// Soft-deleted brands (`deletedAt` set) are never returned by any lookup.
// `findById` fails with `BrandErrors.BRAND_NOT_FOUND` when the brand is missing
// or deleted, and `delete` only fills `deletedAt`, keeping the record.
export interface BrandRepository extends CrudRepository<Brand> {
  findBySlug(slug: string): Promise<Result<Brand | null>>
  // Case-insensitive match on the trimmed name.
  findByName(name: string): Promise<Result<Brand | null>>
}
