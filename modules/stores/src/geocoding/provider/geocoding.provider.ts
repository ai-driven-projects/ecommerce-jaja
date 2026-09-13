import { Result } from '@mentoria-360/shared'
import { GeocodingResultDTO } from '../dto'

// Finds the coordinates of a free-text address. Resolves to ok with `null` when
// the address is not found, and fails with `GeocodingErrors.GEOCODING_UNAVAILABLE`
// when the service does not answer (refused key, quota, network error or
// timeout). Implementations live outside the domain, which knows no provider.
export interface GeocodingProvider {
  geocode(address: string): Promise<Result<GeocodingResultDTO | null>>
}
