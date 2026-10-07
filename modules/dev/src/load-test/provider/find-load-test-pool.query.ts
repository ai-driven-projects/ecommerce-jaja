import { Result } from '@mentoria-360/shared'
import { LoadTestPoolDTO } from '../dto'

/**
 * The ids a synthetic order can use:
 * - `productIds`: products visible in the storefront (not deleted, active, with
 *   the whole category chain active), so the cart has no unavailable line;
 * - `customerUserIds`: users whose customer record is active and not deleted.
 *
 * Either list may be empty: refusing it is a rule of `PlanLoadTestOrder`. The
 * adapter may keep the lists for a few seconds, since a run reads them once per
 * order.
 */
export interface FindLoadTestPoolQuery {
  execute(): Promise<Result<LoadTestPoolDTO>>
}
