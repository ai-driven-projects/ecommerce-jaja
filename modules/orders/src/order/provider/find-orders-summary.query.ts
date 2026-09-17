import { Result } from '@mentoria-360/shared'
import { OrdersSummaryDTO } from '../dto'

/**
 * Indicators of the operation day for the admin dashboard and menu
 * (`GET /orders/summary`).
 *
 * - "Today" is the current day in the operation time zone
 *   (`America/Sao_Paulo`), computed in the database. Order dates are stored in
 *   UTC, so each date is converted to that time zone before taking its day.
 * - `placedToday`, `revenueTodayCents` and `averageTicketTodayCents` consider
 *   the orders whose `placedAt` falls today; `deliveredToday` and
 *   `averageDeliveryMinutesToday` the orders whose `deliveredAt` falls today;
 *   `inProgress` the orders of any day whose status is not `DELIVERED`.
 * - Without orders today, counts and revenue are 0 and
 *   `averageTicketTodayCents` is `null`; without deliveries today,
 *   `averageDeliveryMinutesToday` is `null`.
 * - `latestInProgress` has up to 6 in-progress orders, most recent first
 *   (`placedAt` descending, then `id`), in the shape of the listing rows.
 * - Deleted orders are left out of every value.
 *
 * Called directly by the controller, with no read use case.
 */
export interface FindOrdersSummaryQuery {
  execute(): Promise<Result<OrdersSummaryDTO>>
}
