export const LoadTestErrors = {
  LOAD_TEST_RUN_ID_INVALID: 'LOAD_TEST_RUN_ID_INVALID',
  LOAD_TEST_NO_PRODUCTS: 'LOAD_TEST_NO_PRODUCTS',
  LOAD_TEST_NO_CUSTOMERS: 'LOAD_TEST_NO_CUSTOMERS',
} as const

export type LoadTestErrorCode =
  (typeof LoadTestErrors)[keyof typeof LoadTestErrors]

// A synthetic order has from 1 to this many distinct products...
export const LOAD_TEST_MAX_PRODUCTS_PER_ORDER = 4

// ...each one with a quantity from 1 to this value.
export const LOAD_TEST_MAX_QUANTITY = 3
