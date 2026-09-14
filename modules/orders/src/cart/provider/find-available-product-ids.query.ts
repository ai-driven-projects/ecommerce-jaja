import { Result } from '@mentoria-360/shared'

/**
 * Ids of the given products that are **visible on the storefront**, without
 * repetition. Visibility is the same rule of the storefront queries: the
 * product is not deleted, is active and its category and **all** ancestor
 * categories are active and not deleted.
 *
 * Malformed ids and ids without a product are left out, never failing; an
 * empty list resolves to an empty list. The order of the result is not
 * guaranteed.
 *
 * A dependency of the cart commands (`AddCartItem`, `SetCartItemQuantity`,
 * `MergeCart`), not a read use case.
 */
export interface FindAvailableProductIdsQuery {
  execute(productIds: string[]): Promise<Result<string[]>>
}
