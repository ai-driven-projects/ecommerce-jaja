import { Result } from '@mentoria-360/shared'
import { CartDetailDTO } from '../dto'

/**
 * The cart of the user, with lines and totals computed with the current
 * catalog data. Never resolves to `null`: without a cart (or with a deleted
 * cart, or a malformed `userId`) it resolves to the empty cart (`lines: []`,
 * every total 0, `freeDeliveryThresholdCents` filled and
 * `hasUnavailableItems: false`).
 *
 * - Every item becomes a line, in the order in which each product entered the
 *   cart, including items of deleted or inactive products.
 * - Each line brings slug, name, unit, slug of the root category, thumbnail of
 *   the main image (or `null`), current `priceCents` and `listPriceCents` (or
 *   `null`) and the quantity.
 * - `isAvailable` follows the storefront visibility rule (product not deleted
 *   and active, category and every ancestor active and not deleted). An
 *   unavailable line has `lineTotalCents: null` and stays out of the subtotal;
 *   an available one has `lineTotalCents = priceCents * quantity`.
 * - `itemCount` sums the quantities of every line, unavailable ones included;
 *   `subtotalCents` sums the available lines only.
 * - `deliveryFeeCents` is 0 when the subtotal is 0 or at least
 *   `FREE_DELIVERY_THRESHOLD_CENTS`, otherwise `DELIVERY_FEE_CENTS`;
 *   `totalCents = subtotalCents + deliveryFeeCents`;
 *   `missingForFreeDeliveryCents` is `FREE_DELIVERY_THRESHOLD_CENTS -
 *   subtotalCents` while the delivery is charged, otherwise 0.
 * - `hasUnavailableItems` tells whether any line is unavailable.
 */
export interface FindCartByUserIdQuery {
  execute(userId: string): Promise<Result<CartDetailDTO>>
}
