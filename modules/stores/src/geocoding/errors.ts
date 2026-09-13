export const GeocodingErrors = {
  GEOCODING_ADDRESS_REQUIRED: 'GEOCODING_ADDRESS_REQUIRED',
  GEOCODING_ADDRESS_NOT_FOUND: 'GEOCODING_ADDRESS_NOT_FOUND',
  GEOCODING_UNAVAILABLE: 'GEOCODING_UNAVAILABLE',
} as const

export type GeocodingErrorCode =
  (typeof GeocodingErrors)[keyof typeof GeocodingErrors]
