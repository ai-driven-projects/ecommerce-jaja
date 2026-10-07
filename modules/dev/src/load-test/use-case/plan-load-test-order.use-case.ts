import { Id, Result, UseCase } from '@mentoria-360/shared'
import { LoadTestOrderPlanDTO, PlanLoadTestOrderInputDTO } from '../dto'
import { LoadTestErrors } from '../errors'
import { loadTestInstructions } from '../model'
import { FindLoadTestPoolQuery } from '../provider'
import { SyntheticOrderService } from '../service'

// Plans one order of a load test run. Stops at the first rule that fails:
// 1. a missing or malformed `runId` (not a uuid) fails with
//    `LOAD_TEST_RUN_ID_INVALID`;
// 2. the pool: without visible products fails with `LOAD_TEST_NO_PRODUCTS`,
//    without active customers with `LOAD_TEST_NO_CUSTOMERS`;
// 3. draws the customer and the items (`SyntheticOrderService`) and returns
//    them with the instructions that tag the order as part of the run.
//
// Nothing is written: the order is placed by the orders module, through the
// same `PlaceOrder` of the checkout, so the run exercises the real flow (the
// transaction, the outbox and the simulated services).
export class PlanLoadTestOrder
  implements UseCase<PlanLoadTestOrderInputDTO, LoadTestOrderPlanDTO>
{
  constructor(
    private readonly findLoadTestPool: FindLoadTestPoolQuery,
    private readonly syntheticOrderService: SyntheticOrderService = new SyntheticOrderService(),
  ) {}

  async execute(
    input: PlanLoadTestOrderInputDTO,
  ): Promise<Result<LoadTestOrderPlanDTO>> {
    const data: Partial<PlanLoadTestOrderInputDTO> = input ?? {}

    // `Id.required` fails for a missing value instead of generating a uuid.
    const runId = Id.required(typeof data.runId === 'string' ? data.runId : '')
    if (runId.isFailure) {
      return Result.fail(LoadTestErrors.LOAD_TEST_RUN_ID_INVALID)
    }

    const pool = await this.findLoadTestPool.execute()
    if (pool.isFailure) return pool.withFail

    const items = this.syntheticOrderService.pickItems(pool.instance.productIds)
    if (items.length === 0) return Result.fail(LoadTestErrors.LOAD_TEST_NO_PRODUCTS)

    const customerUserId = this.syntheticOrderService.pickCustomer(
      pool.instance.customerUserIds,
    )
    if (!customerUserId) return Result.fail(LoadTestErrors.LOAD_TEST_NO_CUSTOMERS)

    return Result.ok({
      runId: runId.instance.value,
      customerUserId,
      items,
      deliveryInstructions: loadTestInstructions(runId.instance.value),
    })
  }
}
