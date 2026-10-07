import { Result } from '@mentoria-360/shared';
import type { TransactionContext } from '@mentoria-360/shared';
import {
  Cart,
  CartDetailDTO,
  CartErrors,
  CartRepository,
  FindCartByUserIdQuery,
  PreviewCartQuery,
} from '@jaja/orders';
import type { SyntheticCartItemDTO } from '@jaja/dev';

// The cart of an order of a load test, which exists only in memory: `PlaceOrder`
// runs exactly as in the checkout, but reads these items instead of the
// account cart of the customer, and the real cart of the customer is never
// read nor emptied.

/**
 * `FindCartByUserIdQuery` of the synthetic cart: the lines and totals of the
 * items computed by `CartPrisma.previewCart` (the same SQL of the guest cart,
 * with current prices and availability), whatever the user.
 */
export class SyntheticCartQuery implements FindCartByUserIdQuery {
  constructor(
    private readonly previewCart: PreviewCartQuery,
    private readonly items: readonly SyntheticCartItemDTO[],
  ) {}

  execute(): Promise<Result<CartDetailDTO>> {
    return this.previewCart.execute(this.items.map((item) => ({ ...item })));
  }
}

/**
 * `CartRepository` of the synthetic cart: `findByUserId` answers a cart of the
 * user with the items (built in memory, never stored), and the writes
 * (`create`, `update`, `delete`) store nothing. `PlaceOrder` empties the cart
 * inside its transaction; here that write is a no-op, so the transaction keeps
 * only the order and its `order.placed` event.
 */
export class SyntheticCartRepository implements CartRepository {
  constructor(private readonly items: readonly SyntheticCartItemDTO[]) {}

  async findByUserId(userId: string): Promise<Result<Cart | null>> {
    return Cart.tryCreate({ userId, items: this.items.map((item) => ({ ...item })) });
  }

  async findById(_id: string): Promise<Result<Cart>> {
    return Result.fail(CartErrors.CART_NOT_FOUND);
  }

  async create(_cart: Cart, _tx?: TransactionContext): Promise<Result<void>> {
    return Result.ok();
  }

  async update(_cart: Cart, _tx?: TransactionContext): Promise<Result<void>> {
    return Result.ok();
  }

  async delete(_id: string, _tx?: TransactionContext): Promise<Result<void>> {
    return Result.ok();
  }
}
