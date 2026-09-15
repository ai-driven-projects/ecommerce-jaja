import { Result } from '@mentoria-360/shared'
import {
  CartDetailDTO,
  CartLineDTO,
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  FindCartByUserIdQuery,
} from '../../src/cart'

// Cart projections configured by the test, by `userId`; a user without one
// resolves to the empty cart, as the real query does. Every call is recorded.
export class InMemoryFindCartByUserIdQuery implements FindCartByUserIdQuery {
  private readonly carts = new Map<string, CartDetailDTO>()
  readonly calls: string[] = []

  // The projection of the given lines, with the totals computed by the rules
  // of `FindCartByUserIdQuery`.
  static detailOf(lines: CartLineDTO[]): CartDetailDTO {
    const subtotalCents = lines.reduce(
      (total, line) => total + (line.isAvailable ? line.lineTotalCents ?? 0 : 0),
      0,
    )
    const deliveryFeeCents =
      subtotalCents === 0 || subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS
        ? 0
        : DELIVERY_FEE_CENTS

    return {
      lines,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      subtotalCents,
      deliveryFeeCents,
      totalCents: subtotalCents + deliveryFeeCents,
      freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
      missingForFreeDeliveryCents:
        deliveryFeeCents > 0 ? FREE_DELIVERY_THRESHOLD_CENTS - subtotalCents : 0,
      hasUnavailableItems: lines.some((line) => !line.isAvailable),
    }
  }

  setLines(userId: string, lines: CartLineDTO[]): void {
    this.carts.set(userId, InMemoryFindCartByUserIdQuery.detailOf(lines))
  }

  async execute(userId: string): Promise<Result<CartDetailDTO>> {
    this.calls.push(userId)
    const cart = this.carts.get(userId) ?? InMemoryFindCartByUserIdQuery.detailOf([])
    return Result.ok(structuredClone(cart))
  }
}
