export const CartErrors = {
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  CART_ALREADY_EXISTS: 'CART_ALREADY_EXISTS',
  CART_USER_NOT_FOUND: 'CART_USER_NOT_FOUND',
  CART_PRODUCT_NOT_FOUND: 'CART_PRODUCT_NOT_FOUND',
  CART_ITEM_QUANTITY_INVALID: 'CART_ITEM_QUANTITY_INVALID',
  CART_ITEM_QUANTITY_EXCEEDED: 'CART_ITEM_QUANTITY_EXCEEDED',
  CART_ITEMS_LIMIT_EXCEEDED: 'CART_ITEMS_LIMIT_EXCEEDED',
  CART_ITEM_DUPLICATED: 'CART_ITEM_DUPLICATED',
} as const

export type CartErrorCode = (typeof CartErrors)[keyof typeof CartErrors]

/** Maximum number of different products in a cart. */
export const CART_MAX_ITEMS = 50

/** Maximum number of units of a single product in a cart. */
export const CART_ITEM_MAX_QUANTITY = 99

/**
 * Delivery fee, in cents, charged while the subtotal of the available lines is
 * greater than 0 and lower than `FREE_DELIVERY_THRESHOLD_CENTS`. Also used by
 * the order.
 */
export const DELIVERY_FEE_CENTS = 490

/**
 * Subtotal, in cents, from which the delivery is free (`deliveryFeeCents: 0`).
 * Also used by the order.
 */
export const FREE_DELIVERY_THRESHOLD_CENTS = 7900
