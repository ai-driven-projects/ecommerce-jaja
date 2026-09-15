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
} as const

export type OrderErrorCode = (typeof OrderErrors)[keyof typeof OrderErrors]

/**
 * Statuses an order can have. `PLACED` ("Pedido recebido") is the status of
 * every new order; the next deliveries append the others here. Stored as text,
 * so a new status needs no database type migration.
 */
export const ORDER_STATUSES = ['PLACED'] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Maximum length of the recipient name, after trimming (minimum 2). */
export const ORDER_RECIPIENT_NAME_MAX_LENGTH = 100

/** Maximum length of the delivery instructions, after trimming. */
export const ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200
