import { Result } from '@mentoria-360/shared';
import { GeocodingErrors } from '@jaja/stores';
import type { GeocodingProvider, GeocodingResultDTO } from '@jaja/stores';

// Simulated point: Avenida Paulista, 1578 (in front of MASP). The frontend repeats
// these values in `STORE_MOCK_LOCATION`.
export const MOCK_GEOCODING_RESULT: GeocodingResultDTO = {
  latitude: -23.561414,
  longitude: -46.655881,
  formattedAddress: 'Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200',
  source: 'mock',
};

/**
 * Used when `GOOGLE_MAPS_API_KEY` is empty: answers any non-empty address with
 * the same simulated point, without calling any external service.
 */
export class MockGeocodingProvider implements GeocodingProvider {
  async geocode(address: string): Promise<Result<GeocodingResultDTO | null>> {
    if (typeof address !== 'string' || !address.trim()) {
      return Result.fail<GeocodingResultDTO | null>(GeocodingErrors.GEOCODING_ADDRESS_REQUIRED);
    }
    return Result.ok<GeocodingResultDTO | null>({ ...MOCK_GEOCODING_RESULT });
  }
}
