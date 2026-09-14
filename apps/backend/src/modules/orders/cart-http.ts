import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Id } from '@mentoria-360/shared';
import {
  CART_ITEM_MAX_QUANTITY,
  CART_MAX_ITEMS,
  CartErrors,
  CartItemInputDTO,
} from '@jaja/orders';

// HTTP helpers shared by `MyCartController` (the account cart) and
// `CartController` (the guest preview): both read the items built in the
// browser and translate the failures the same way.

export type AddCartItemBody = {
  productId: string;
  // Missing means 1.
  quantity?: number;
};

export type SetCartItemQuantityBody = {
  quantity: number;
};

export type CartItemsBody = {
  items: CartItemInputDTO[];
};

/**
 * Normalizes the items of a guest cart (preview and merge) without ever
 * failing, so an old or tampered `localStorage` never blocks the store:
 * - `items` that is not a list (or a missing body) becomes `[]`;
 * - entries without a uuid `productId` or without an integer `quantity` >= 1
 *   are discarded;
 * - the quantities of a repeated `productId` are summed into its first entry;
 * - each quantity is limited to `CART_ITEM_MAX_QUANTITY`;
 * - only the first `CART_MAX_ITEMS` products are kept.
 */
export function toGuestItems(body: CartItemsBody | undefined): CartItemInputDTO[] {
  const entries: unknown[] = Array.isArray(body?.items) ? body.items : [];
  const items: CartItemInputDTO[] = [];
  const indexByProduct = new Map<string, number>();

  for (const entry of entries) {
    const { productId, quantity } = (entry ?? {}) as Record<string, unknown>;
    if (typeof productId !== 'string' || !Id.isValid(productId.trim())) continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      continue;
    }

    const key = productId.trim().toLowerCase();
    const index = indexByProduct.get(key);
    if (index !== undefined) {
      const current = items[index]!;
      current.quantity = Math.min(current.quantity + quantity, CART_ITEM_MAX_QUANTITY);
      continue;
    }
    if (items.length >= CART_MAX_ITEMS) continue;

    indexByProduct.set(key, items.length);
    items.push({ productId: key, quantity: Math.min(quantity, CART_ITEM_MAX_QUANTITY) });
  }

  return items;
}

export function throwFailure(errors: string[]): never {
  // Value objects may repeat a code; the API exposes each code once.
  const codes = [...new Set(errors)];
  if (
    codes.includes(CartErrors.CART_PRODUCT_NOT_FOUND) ||
    codes.includes(CartErrors.CART_USER_NOT_FOUND)
  ) {
    throw new NotFoundException(codes);
  }
  if (codes.includes(CartErrors.CART_ALREADY_EXISTS)) {
    throw new ConflictException(codes);
  }
  throw new BadRequestException(codes);
}
