export const OrderErrors = {
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_ALREADY_EXISTS: 'ORDER_ALREADY_EXISTS',
  ORDER_CUSTOMER_REQUIRED: 'ORDER_CUSTOMER_REQUIRED',
  ORDER_CUSTOMER_INACTIVE: 'ORDER_CUSTOMER_INACTIVE',
  ORDER_CUSTOMER_NOT_FOUND: 'ORDER_CUSTOMER_NOT_FOUND',
  ORDER_CART_EMPTY: 'ORDER_CART_EMPTY',
  ORDER_CART_HAS_UNAVAILABLE_ITEMS: 'ORDER_CART_HAS_UNAVAILABLE_ITEMS',
  ORDER_PRODUCT_NOT_FOUND: 'ORDER_PRODUCT_NOT_FOUND',
  ORDER_ITEMS_REQUIRED: 'ORDER_ITEMS_REQUIRED',
  ORDER_ITEMS_LIMIT_EXCEEDED: 'ORDER_ITEMS_LIMIT_EXCEEDED',
  ORDER_ITEM_DUPLICATED: 'ORDER_ITEM_DUPLICATED',
  ORDER_ITEM_QUANTITY_INVALID: 'ORDER_ITEM_QUANTITY_INVALID',
  ORDER_ITEM_PRICE_INVALID: 'ORDER_ITEM_PRICE_INVALID',
  ORDER_DELIVERY_ADDRESS_INVALID: 'ORDER_DELIVERY_ADDRESS_INVALID',
  ORDER_STATUS_INVALID: 'ORDER_STATUS_INVALID',
  ORDER_STATUS_TRANSITION_INVALID: 'ORDER_STATUS_TRANSITION_INVALID',
  ORDER_PAYMENT_DATA_INVALID: 'ORDER_PAYMENT_DATA_INVALID',
  ORDER_PICKING_DATA_INVALID: 'ORDER_PICKING_DATA_INVALID',
  ORDER_DISPATCH_DATA_INVALID: 'ORDER_DISPATCH_DATA_INVALID',
  ORDER_DELIVERY_DATA_INVALID: 'ORDER_DELIVERY_DATA_INVALID',
} as const

export type OrderErrorCode = (typeof OrderErrors)[keyof typeof OrderErrors]

/**
 * Statuses an order can have, **in the order of the sequence**:
 * `PLACED` ("Pedido recebido") → `PAYMENT_APPROVED` ("Pagamento aprovado") →
 * `PICKING` ("Separando na loja") → `OUT_FOR_DELIVERY` ("A caminho") →
 * `DELIVERED` ("Entregue").
 *
 * Every new order starts `PLACED`, and each status only advances to the next
 * one (`Order.advanceTo`): staying, going back, skipping a step or advancing
 * after `DELIVERED` fails with `ORDER_STATUS_TRANSITION_INVALID`. Stored as
 * text, so a new status needs no database type migration.
 */
export const ORDER_STATUSES = [
  'PLACED',
  'PAYMENT_APPROVED',
  'PICKING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Position of the status in `ORDER_STATUSES` (`PLACED` is 0, `DELIVERED` is 4).
 * Comparing positions tells whether an order has reached a status.
 */
export function orderStatusIndex(status: OrderStatus): number {
  return ORDER_STATUSES.indexOf(status)
}

/**
 * Means of payment an approved payment can have. Only `SIMULATED` is used
 * today: the simulated gateway approves every order and there is no payment
 * data in this version. `CREDIT_CARD` and `PIX` document where the real means
 * land when a payment of its own exists.
 */
export const ORDER_PAYMENT_METHODS = ['SIMULATED', 'CREDIT_CARD', 'PIX'] as const

export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number]

/** Maximum length of the recipient name, after trimming (minimum 2). */
export const ORDER_RECIPIENT_NAME_MAX_LENGTH = 100

/** Maximum length of the delivery instructions, after trimming. */
export const ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200
