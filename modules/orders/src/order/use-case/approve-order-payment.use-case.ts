import { Result } from '@mentoria-360/shared'
import { ApproveOrderPaymentInputDTO } from '../dto'
import { OrderStepStatus } from '../event'
import { Order } from '../model'
import { OrderStepUseCase } from './order-step.use-case'

/**
 * The payment of the order was approved: the order advances to
 * `PAYMENT_APPROVED` and records `order.payment-approved` with the transaction
 * of the gateway, the means of payment and the total approved, in the same
 * transaction.
 *
 * Called by the simulated payment gateway (`payment.approve-order`), which
 * reacts to `order.placed`. Fails with `ORDER_PAYMENT_DATA_INVALID` for a blank
 * transaction, one longer than 64 characters or an unknown means of payment; an
 * order that is not `PLACED` fails with `ORDER_STATUS_TRANSITION_INVALID`,
 * except when the payment had already been approved, which ends with
 * `changed: false`.
 */
export class ApproveOrderPayment extends OrderStepUseCase<ApproveOrderPaymentInputDTO> {
  protected get status(): OrderStepStatus {
    return 'PAYMENT_APPROVED'
  }

  protected applyTo(
    order: Order,
    input: ApproveOrderPaymentInputDTO,
  ): Result<Order> {
    return order.approvePayment({
      transactionId: input.transactionId,
      paymentMethod: input.paymentMethod,
    })
  }
}
