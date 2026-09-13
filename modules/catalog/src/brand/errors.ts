export const BrandErrors = {
  BRAND_NOT_FOUND: 'BRAND_NOT_FOUND',
  BRAND_NAME_ALREADY_EXISTS: 'BRAND_NAME_ALREADY_EXISTS',
  BRAND_SLUG_ALREADY_EXISTS: 'BRAND_SLUG_ALREADY_EXISTS',
  BRAND_HAS_PRODUCTS: 'BRAND_HAS_PRODUCTS',
} as const

export type BrandErrorCode = (typeof BrandErrors)[keyof typeof BrandErrors]
