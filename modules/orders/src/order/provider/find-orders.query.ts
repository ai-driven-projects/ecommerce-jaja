import { Result } from '@mentoria-360/shared'
import { OrderFiltersDTO, OrderPageDTO } from '../dto'

/**
 * One page of orders of every customer, for the admin order listing
 * (`GET /orders`).
 *
 * - Only orders that are not deleted are returned, most recent first
 *   (`placedAt` descending, then `id`).
 * - `status`, when defined, keeps only orders with that status; `IN_PROGRESS`
 *   keeps every order whose status is not `DELIVERED`.
 * - `search`, when defined, keeps orders whose number or customer name match,
 *   ignoring case (and accents, for the name):
 *   - the order number is the start of the id without dashes (the first 8
 *     characters, shown uppercase): the id must start with the text without
 *     dashes and spaces, compared only when that text is hexadecimal;
 *   - the customer name (name of the linked user) must contain every term of
 *     the text;
 *   - either condition is enough.
 * - `itemCount` is the sum of the item quantities, and `statusChangedAt` is
 *   the date of the most recent step reached (or `placedAt`).
 * - `total` counts every order that matches the filters, and `totalPages` is
 *   `ceil(total / pageSize)`; a page beyond the last one has no items.
 *
 * `filters` arrives normalized by the controller (valid `page`/`pageSize`,
 * known `status`, trimmed non-empty `search`). Called directly by the
 * controller, with no read use case.
 */
export interface FindOrdersQuery {
  execute(filters: OrderFiltersDTO): Promise<Result<OrderPageDTO>>
}
