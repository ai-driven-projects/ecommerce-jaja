import { SyntheticCartItemDTO } from '../dto'
import { LOAD_TEST_MAX_PRODUCTS_PER_ORDER, LOAD_TEST_MAX_QUANTITY } from '../errors'

// A number in [0, 1), like `Math.random`. The tests inject a fixed sequence.
export type RandomSource = () => number

/**
 * Draws the parts of a synthetic order. Pure apart from the random source:
 * the same sequence of numbers always draws the same order.
 */
export class SyntheticOrderService {
  constructor(private readonly random: RandomSource = Math.random) {}

  // One of `userIds`; `undefined` when the list is empty.
  pickCustomer(userIds: readonly string[]): string | undefined {
    return userIds[this.index(userIds.length)]
  }

  // From 1 to `LOAD_TEST_MAX_PRODUCTS_PER_ORDER` distinct products (never more
  // than the list has), each with a quantity from 1 to
  // `LOAD_TEST_MAX_QUANTITY`. Repeated ids in the list count once; an empty
  // list draws no item.
  pickItems(productIds: readonly string[]): SyntheticCartItemDTO[] {
    const available = [...new Set(productIds)]
    const count = Math.min(
      available.length,
      1 + this.index(LOAD_TEST_MAX_PRODUCTS_PER_ORDER),
    )

    const items: SyntheticCartItemDTO[] = []
    for (let drawn = 0; drawn < count; drawn++) {
      // Removes the drawn product, so no product repeats in the cart.
      const [productId] = available.splice(this.index(available.length), 1)
      items.push({
        productId: productId!,
        quantity: 1 + this.index(LOAD_TEST_MAX_QUANTITY),
      })
    }
    return items
  }

  // An integer from 0 to `size - 1`; a source outside [0, 1) is clamped.
  private index(size: number): number {
    if (size <= 0) return 0
    const value = Math.min(Math.max(this.random(), 0), 1 - Number.EPSILON)
    return Math.floor(value * size)
  }
}
