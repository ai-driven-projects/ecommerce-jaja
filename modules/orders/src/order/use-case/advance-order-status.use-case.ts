import {
  DomainEventRepository,
  Id,
  Result,
  ResultError,
  TransactionManager,
  UseCase,
} from '@mentoria-360/shared'
import {
  AdvanceOrderStatusInputDTO,
  AdvanceOrderStatusOutputDTO,
} from '../dto'
import { OrderErrors } from '../errors'
import { Order } from '../model'
import { OrderRepository } from '../provider'

/**
 * Advances an order one step of the sequence (`PLACED` → `PAYMENT_APPROVED` →
 * `PICKING` → `OUT_FOR_DELIVERY` → `DELIVERED`), storing the order and the
 * `OrderStatusChangedEvent` in the same transaction. Stops at the first rule
 * that fails:
 * 1. a missing or malformed `orderId` fails with the `Id` error; a `status`
 *    outside `ORDER_STATUSES`, or `PLACED`, fails with `ORDER_STATUS_INVALID`;
 * 2. the order is read with `findById` (a failure, `ORDER_NOT_FOUND` included,
 *    stops the flow);
 * 3. when the order has already reached the status (or passed it), returns
 *    `{ status: <current>, changed: false }` **without opening a transaction**
 *    and without storing anything;
 * 4. `order.advanceTo(status)`: a status other than the next one (e.g. a
 *    skipped step) fails with `ORDER_STATUS_TRANSITION_INVALID`;
 * 5. in a single transaction: the order (`update`) and its event (`append`, the
 *    outbox) are stored with the same `tx`. Each failure is thrown to roll
 *    everything back and returned as `Result.fail`;
 * 6. returns `{ status, changed: true }`.
 *
 * Called by the simulated services (payment, picking, delivery) with the
 * `transactionManager` of the consumer, so the writes join the transaction
 * that marks the message as processed.
 *
 * `findById` receives no transaction in the shared contract, so the order is
 * read before the transaction starts. In this version only one service
 * advances each step, and the idempotency of the consumer covers repeated
 * messages; two producers of the same step would need a conditional update.
 *
 * "Already reached" ends with success to tolerate repeated or out-of-order
 * messages: a message that no longer applies is not an error.
 */
export class AdvanceOrderStatus
  implements UseCase<AdvanceOrderStatusInputDTO, AdvanceOrderStatusOutputDTO>
{
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly domainEventRepository: DomainEventRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: AdvanceOrderStatusInputDTO,
  ): Promise<Result<AdvanceOrderStatusOutputDTO>> {
    const data: Partial<AdvanceOrderStatusInputDTO> = input ?? {}

    // `Id.required` fails for a missing value instead of generating a uuid.
    const orderId = Id.required(
      typeof data.orderId === 'string' ? data.orderId : '',
    )
    if (orderId.isFailure) return orderId.withFail

    const status = data.status
    if (!Order.isValidStatus(status) || status === 'PLACED') {
      return Result.fail(OrderErrors.ORDER_STATUS_INVALID)
    }

    const order = await this.orderRepository.findById(orderId.instance.value)
    if (order.isFailure) return order.withFail

    if (order.instance.hasReached(status)) {
      return Result.ok({ status: order.instance.status, changed: false })
    }

    const advanced = order.instance.advanceTo(status)
    if (advanced.isFailure) return advanced.withFail

    try {
      // Throwing inside the callback is what makes the transaction roll back.
      await this.transactionManager.runInTransaction(async (tx) => {
        const updated = await this.orderRepository.update(advanced.instance, tx)
        updated.validator.throwsIfFailed()

        const appended = await this.domainEventRepository.append(
          advanced.instance.pullEvents(),
          tx,
        )
        appended.validator.throwsIfFailed()
      })
    } catch (error) {
      if (error instanceof ResultError) return Result.fail(error.errors)
      throw error
    }

    return Result.ok({ status: advanced.instance.status, changed: true })
  }
}
