import { Result } from '@mentoria-360/shared'
import { StorefrontStoreDTO } from '../dto'

// Public read of the stores for the storefront, accessible without a token.
// Only active and non-deleted stores, ordered by name (ignoring case and
// accents). Each item carries only the fields of `StorefrontStoreDTO`: never the
// phone, the status or the dates. Resolves to an empty list when there is no
// active store.
export interface FindStorefrontStoresQuery {
  execute(): Promise<Result<StorefrontStoreDTO[]>>
}
