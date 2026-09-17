// A store as shown by the storefront (public read): no administrative data such
// as `phone`, `isActive` or dates. `address` is the store's reference text or
// `null`; `latitude`/`longitude` are decimal degrees rounded to 6 places;
// `deliveryRadiusMeters` is in meters, in a straight line.
export interface StorefrontStoreDTO {
  id: string
  name: string
  slug: string
  address: string | null
  latitude: number
  longitude: number
  deliveryRadiusMeters: number
}
