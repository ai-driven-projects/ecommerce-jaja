import {
  DomainEventRepository,
  Id,
  Result,
  ResultError,
  TransactionManager,
  UseCase,
} from '@mentoria-360/shared'
import { CartRepository, FindCartByUserIdQuery } from '../../cart'
import { PlaceOrderInputDTO, PlaceOrderOutputDTO } from '../dto'
import { OrderErrors } from '../errors'
import { Order } from '../model'
import { FindOrderCustomerByUserIdQuery, OrderRepository } from '../provider'

// Places the order of the user from the account cart (the "Confirmar pedido" of
// the checkout). Customer, items and prices always come from the server; the
// input only brings the recipient and the delivery instructions. Stops at the
// first rule that fails, and every rule is checked before any write:
// 1. a missing or malformed `userId` fails with the `Id` error;
// 2. the customer record: missing (or deleted) fails with
//    `ORDER_CUSTOMER_REQUIRED`, inactive with `ORDER_CUSTOMER_INACTIVE`;
// 3. the cart with the current prices: without lines fails with
//    `ORDER_CART_EMPTY`, with any unavailable line with
//    `ORDER_CART_HAS_UNAVAILABLE_ITEMS`;
// 4. `Order.place` with the cart lines (`priceCents` frozen as
//    `unitPriceCents`), the customer's address and the informed recipient
//    (trimmed) or, when blank, the name of the user; its validation failures
//    stop the flow;
// 5. the account cart is read with `CartRepository` and cleared (a missing cart
//    fails with `ORDER_CART_EMPTY`);
// 6. in a single transaction: the order, the cleared cart and the
//    `order.placed` event (outbox) are stored with the same `tx`. Each failure
//    is thrown to roll everything back and returned as `Result.fail`;
// 7. returns `{ orderId }`.
//
// The cart read in step 3 and the one cleared in step 6 may diverge when the
// customer changes the cart on another device in between: the order keeps the
// lines of step 3 and the cart is emptied anyway. Accepted in this version.
export class PlaceOrder
  implements UseCase<PlaceOrderInputDTO, PlaceOrderOutputDTO>
{
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly cartRepository: CartRepository,
    private readonly findOrderCustomerByUserId: FindOrderCustomerByUserIdQuery,
    private readonly findCartByUserId: FindCartByUserIdQuery,
    private readonly domainEventRepository: DomainEventRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(
    input: PlaceOrderInputDTO,
  ): Promise<Result<PlaceOrderOutputDTO>> {
    const data: Partial<PlaceOrderInputDTO> = input ?? {}

    // `Id.required` fails for a missing value instead of generating a uuid.
    const userId = Id.required(
      typeof data.userId === 'string' ? data.userId : '',
    )
    if (userId.isFailure) return userId.withFail

    const customer = await this.findOrderCustomerByUserId.execute(
      userId.instance.value,
    )
    if (customer.isFailure) return customer.withFail
    if (!customer.instance) {
      return Result.fail(OrderErrors.ORDER_CUSTOMER_REQUIRED)
    }
    if (!customer.instance.isActive) {
      return Result.fail(OrderErrors.ORDER_CUSTOMER_INACTIVE)
    }

    const cartDetail = await this.findCartByUserId.execute(
      userId.instance.value,
    )
    if (cartDetail.isFailure) return cartDetail.withFail
    if (cartDetail.instance.lines.length === 0) {
      return Result.fail(OrderErrors.ORDER_CART_EMPTY)
    }
    if (cartDetail.instance.hasUnavailableItems) {
      return Result.fail(OrderErrors.ORDER_CART_HAS_UNAVAILABLE_ITEMS)
    }

    const order = Order.place({
      customerId: customer.instance.customerId,
      items: cartDetail.instance.lines.map((line) => ({
        productId: line.productId,
        name: line.name,
        unit: line.unit,
        thumbUrl: line.thumbUrl,
        unitPriceCents: line.priceCents,
        quantity: line.quantity,
      })),
      deliveryAddress: customer.instance.deliveryAddress,
      recipientName: textOrEmpty(data.recipientName) || customer.instance.name,
      deliveryInstructions: textOrEmpty(data.deliveryInstructions) || null,
    })
    if (order.isFailure) return order.withFail

    const existing = await this.cartRepository.findByUserId(
      userId.instance.value,
    )
    if (existing.isFailure) return existing.withFail
    if (!existing.instance) return Result.fail(OrderErrors.ORDER_CART_EMPTY)

    const cart = existing.instance.clear()
    if (cart.isFailure) return cart.withFail

    try {
      // Throwing inside the callback is what makes the transaction roll back.
      await this.transactionManager.runInTransaction(async (tx) => {
        const created = await this.orderRepository.create(order.instance, tx)
        created.validator.throwsIfFailed()

        const updated = await this.cartRepository.update(cart.instance, tx)
        updated.validator.throwsIfFailed()

        const appended = await this.domainEventRepository.append(
          order.instance.pullEvents(),
          tx,
        )
        appended.validator.throwsIfFailed()
      })
    } catch (error) {
      if (error instanceof ResultError) return Result.fail(error.errors)
      throw error
    }

    return Result.ok({ orderId: order.instance.id })
  }
}

// The trimmed text, or '' when the value is not a string.
function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
