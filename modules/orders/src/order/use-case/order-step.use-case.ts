import {
  DomainEventRepository,
  Id,
  Result,
  ResultError,
  TransactionManager,
  UseCase,
} from '@mentoria-360/shared'
import { OrderStepOutputDTO } from '../dto'
import { OrderStepStatus } from '../event'
import { Order } from '../model'
import { OrderRepository } from '../provider'

// Every operation of a step receives the order it acts on.
export interface OrderStepInput {
  orderId: string
}

/**
 * The mechanics shared by the four operations of the cycle (`ApproveOrderPayment`,
 * `StartOrderPicking`, `DispatchOrder` and `CompleteOrderDelivery`), so that
 * transaction and idempotency live in one place. Each operation only declares
 * the step it concludes (`status`) and how to apply it to the order
 * (`applyTo`), which validates the data of the step through the method of the
 * entity.
 *
 * `execute` stops at the first rule that fails:
 * 1. a missing or malformed `orderId` fails with the `Id` error;
 * 2. the order is read with `findById` (a failure, `ORDER_NOT_FOUND` included,
 *    stops the flow);
 * 3. when the order has already concluded the step (or a later one), returns
 *    `{ status: <current>, changed: false }` **without opening a transaction**
 *    and without storing anything;
 * 4. `applyTo`: data of the step that is invalid fails with the code of the
 *    step, and a step out of order (the previous one is not concluded) fails
 *    with `ORDER_STATUS_TRANSITION_INVALID`;
 * 5. in a single transaction: the order (`update`) and its event (`append`, the
 *    outbox) are stored with the same `tx`. Each failure is thrown to roll
 *    everything back and returned as `Result.fail`;
 * 6. returns `{ status, changed: true }`.
 *
 * Called by the simulated services (payment, store, delivery) with the
 * `transactionManager` of the consumer, so the writes join the transaction that
 * marks the message as processed.
 *
 * `findById` receives no transaction in the shared contract, so the order is
 * read before the transaction starts. In this version only one service
 * concludes each step, and the idempotency of the consumer covers repeated
 * messages; two producers of the same step would need a conditional update.
 *
 * "Already concluded" ends with success to tolerate repeated or out-of-order
 * messages: a message that no longer applies is not an error.
 */
export abstract class OrderStepUseCase<IN extends OrderStepInput>
  implements UseCase<IN, OrderStepOutputDTO>
{
  constructor(
    protected readonly orderRepository: OrderRepository,
    protected readonly domainEventRepository: DomainEventRepository,
    protected readonly transactionManager: TransactionManager,
  ) {}

  // The step this operation concludes.
  protected abstract get status(): OrderStepStatus

  // Calls the method of the entity of this step, which validates the data of
  // the step and records its event.
  protected abstract applyTo(order: Order, input: IN): Result<Order>

  async execute(input: IN): Promise<Result<OrderStepOutputDTO>> {
    const data = (input ?? {}) as Partial<IN>

    // `Id.required` fails for a missing value instead of generating a uuid.
    const orderId = Id.required(
      typeof data.orderId === 'string' ? data.orderId : '',
    )
    if (orderId.isFailure) return orderId.withFail

    const order = await this.orderRepository.findById(orderId.instance.value)
    if (order.isFailure) return order.withFail

    if (order.instance.hasReached(this.status)) {
      return Result.ok({ status: order.instance.status, changed: false })
    }

    const applied = this.applyTo(order.instance, input)
    if (applied.isFailure) return applied.withFail

    try {
      // Throwing inside the callback is what makes the transaction roll back.
      await this.transactionManager.runInTransaction(async (tx) => {
        const updated = await this.orderRepository.update(applied.instance, tx)
        updated.validator.throwsIfFailed()

        const appended = await this.domainEventRepository.append(
          applied.instance.pullEvents(),
          tx,
        )
        appended.validator.throwsIfFailed()
      })
    } catch (error) {
      if (error instanceof ResultError) return Result.fail(error.errors)
      throw error
    }

    return Result.ok({ status: applied.instance.status, changed: true })
  }
}
