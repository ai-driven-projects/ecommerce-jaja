import type { CartDetail, CartItemInput } from './cart.api';

// Espelham as constantes de `@jaja/orders` (`cart/errors.ts`): o frontend não
// importa os pacotes de domínio. Os valores monetários exibidos vêm sempre da
// API; estas constantes só decidem os limites do visitante e os textos da loja.

/** Unidades por produto no carrinho. Espelha `CART_ITEM_MAX_QUANTITY` de `@jaja/orders`. */
export const CART_ITEM_MAX_QUANTITY = 99;
/** Produtos diferentes no carrinho. Espelha `CART_MAX_ITEMS` de `@jaja/orders`. */
export const CART_MAX_ITEMS = 50;
/** Taxa fixa de entrega abaixo do limite. Espelha `DELIVERY_FEE_CENTS` de `@jaja/orders`. */
export const DELIVERY_FEE_CENTS = 490;
/** Subtotal a partir do qual a entrega é grátis. Espelha `FREE_DELIVERY_THRESHOLD_CENTS` de `@jaja/orders`. */
export const FREE_DELIVERY_THRESHOLD_CENTS = 7900;

/** Código de erro das regras do carrinho do visitante (os mesmos da entidade `Cart`). */
export type GuestCartErrorCode = 'CART_ITEM_QUANTITY_EXCEEDED' | 'CART_ITEMS_LIMIT_EXCEEDED' | 'CART_ITEM_QUANTITY_INVALID';

/** Resultado de uma mudança no carrinho do visitante: a nova lista ou o erro, sem alterar a original. */
export type GuestCartResult = { items: CartItemInput[]; error?: never } | { error: GuestCartErrorCode; items?: never };

/** Carrinho vazio, com os totais zerados. */
export function emptyCartDetail(): CartDetail {
  return {
    lines: [],
    itemCount: 0,
    subtotalCents: 0,
    deliveryFeeCents: 0,
    totalCents: 0,
    freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
    missingForFreeDeliveryCents: 0,
    hasUnavailableItems: false,
  };
}

/** Quantidade inteira de 1 a `CART_ITEM_MAX_QUANTITY`. */
export function isValidCartQuantity(quantity: unknown): quantity is number {
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1 && quantity <= CART_ITEM_MAX_QUANTITY;
}

/**
 * Soma `quantity` ao produto, mantendo a posição, ou o inclui no fim. Soma
 * acima de 99 → `CART_ITEM_QUANTITY_EXCEEDED`; 51º produto →
 * `CART_ITEMS_LIMIT_EXCEEDED`; quantidade inválida → `CART_ITEM_QUANTITY_INVALID`.
 */
export function addGuestItem(items: readonly CartItemInput[], productId: string, quantity: number): GuestCartResult {
  if (!isValidCartQuantity(quantity)) return { error: 'CART_ITEM_QUANTITY_INVALID' };

  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    const total = existing.quantity + quantity;
    if (total > CART_ITEM_MAX_QUANTITY) return { error: 'CART_ITEM_QUANTITY_EXCEEDED' };
    return { items: items.map((item) => (item.productId === productId ? { productId, quantity: total } : item)) };
  }

  if (items.length >= CART_MAX_ITEMS) return { error: 'CART_ITEMS_LIMIT_EXCEEDED' };
  return { items: [...items, { productId, quantity }] };
}

/**
 * Define a quantidade do produto, mantendo a posição, ou o inclui no fim; 0
 * remove. Acima de 99 → `CART_ITEM_QUANTITY_EXCEEDED`; 51º produto →
 * `CART_ITEMS_LIMIT_EXCEEDED`; negativa ou fracionária → `CART_ITEM_QUANTITY_INVALID`.
 */
export function setGuestItemQuantity(items: readonly CartItemInput[], productId: string, quantity: number): GuestCartResult {
  if (quantity === 0) return removeGuestItem(items, productId);
  if (Number.isInteger(quantity) && quantity > CART_ITEM_MAX_QUANTITY) return { error: 'CART_ITEM_QUANTITY_EXCEEDED' };
  if (!isValidCartQuantity(quantity)) return { error: 'CART_ITEM_QUANTITY_INVALID' };

  if (items.some((item) => item.productId === productId)) {
    return { items: items.map((item) => (item.productId === productId ? { productId, quantity } : item)) };
  }

  if (items.length >= CART_MAX_ITEMS) return { error: 'CART_ITEMS_LIMIT_EXCEEDED' };
  return { items: [...items, { productId, quantity }] };
}

/** Remove o produto; ausente devolve a mesma lista. */
export function removeGuestItem(items: readonly CartItemInput[], productId: string): GuestCartResult {
  if (!items.some((item) => item.productId === productId)) return { items: [...items] };
  return { items: items.filter((item) => item.productId !== productId) };
}
