export const StoreErrors = {
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',
  STORE_NAME_ALREADY_EXISTS: 'STORE_NAME_ALREADY_EXISTS',
  STORE_SLUG_ALREADY_EXISTS: 'STORE_SLUG_ALREADY_EXISTS',
  GEO_POINT_LATITUDE_INVALID: 'GEO_POINT_LATITUDE_INVALID',
  GEO_POINT_LONGITUDE_INVALID: 'GEO_POINT_LONGITUDE_INVALID',
  DELIVERY_RADIUS_INVALID: 'DELIVERY_RADIUS_INVALID',
} as const

export type StoreErrorCode = (typeof StoreErrors)[keyof typeof StoreErrors]

// Limits of the delivery radius, in meters, measured in a straight line from
// the store point. The radius is informative: no rule restricts orders by it.
export const STORE_MIN_DELIVERY_RADIUS_METERS = 300
export const STORE_MAX_DELIVERY_RADIUS_METERS = 10000

// Radius used when a new store does not inform one.
export const STORE_DEFAULT_DELIVERY_RADIUS_METERS = 1000
