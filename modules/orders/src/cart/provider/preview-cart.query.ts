import { Result } from '@mentoria-360/shared'
import { CartDetailDTO, CartItemInputDTO } from '../dto'

/**
 * The same projection of `FindCartByUserIdQuery` for the guest cart, computed
 * from the received items without reading or changing any stored cart.
 *
 * - The items are expected already normalized by the caller (valid uuids,
 *   quantities from 1 to `CART_ITEM_MAX_QUANTITY`, no repeated product, at most
 *   `CART_MAX_ITEMS`).
 * - The lines keep the order of the input. A `productId` without a product in
 *   the table is omitted; an existing product that is not visible on the
 *   storefront (deleted, inactive or with an inactive or deleted category or
 *   ancestor) becomes an unavailable line (`isAvailable: false`,
 *   `lineTotalCents: null`).
 * - Totals, delivery fee and `hasUnavailableItems` follow the same rules of
 *   `FindCartByUserIdQuery`.
 * - An empty list resolves to the empty cart (`lines: []`, every total 0).
 */
export interface PreviewCartQuery {
  execute(items: CartItemInputDTO[]): Promise<Result<CartDetailDTO>>
}
