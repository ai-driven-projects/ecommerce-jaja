import { Result } from '@mentoria-360/shared'
import { AddressSuggestionDTO, GeocodingResultDTO } from '../dto'

// Map provider for geocoding. Implementations live outside the domain, which
// knows no provider.
// - `geocode` finds the coordinates of a free-text address. Resolves to ok with
//   `null` when the address is not found.
// - `reverseGeocode` suggests the address closest to a point (decimal degrees).
//   The point is validated by `GeoPoint.tryCreate` before any call to the
//   service, failing with `GeocodingErrors.GEOCODING_LOCATION_INVALID`. Resolves
//   to ok with `null` when there is no address for the point; the suggestion
//   carries the queried point, rounded, and not the coordinates of the
//   provider's result.
// Both fail with `GeocodingErrors.GEOCODING_UNAVAILABLE` when the service does
// not answer (refused key, quota, network error or timeout).
export interface GeocodingProvider {
  geocode(address: string): Promise<Result<GeocodingResultDTO | null>>
  reverseGeocode(point: {
    latitude: number
    longitude: number
  }): Promise<Result<AddressSuggestionDTO | null>>
}
