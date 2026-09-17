import { Result } from '@mentoria-360/shared';
import { GeoPoint, GeocodingErrors } from '@jaja/stores';
import type {
  AddressSuggestionDTO,
  GeocodingProvider,
  GeocodingResultDTO,
} from '@jaja/stores';

// Simulated point: Avenida Paulista, 1578 (in front of MASP). The frontend repeats
// these values in `STORE_MOCK_LOCATION`.
export const MOCK_GEOCODING_RESULT: GeocodingResultDTO = {
  latitude: -23.561414,
  longitude: -46.655881,
  formattedAddress: 'Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200',
  source: 'mock',
};

// Simulated address suggested for any point: the same Avenida Paulista, 1578.
// The coordinates are always those of the queried point.
export const MOCK_ADDRESS_SUGGESTION: Omit<AddressSuggestionDTO, 'latitude' | 'longitude'> = {
  formattedAddress: MOCK_GEOCODING_RESULT.formattedAddress,
  zipCode: '01310200',
  street: 'Avenida Paulista',
  number: '1578',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  source: 'mock',
};

/**
 * Used when `GOOGLE_MAPS_API_KEY` is empty: answers any non-empty address with
 * the same simulated point, and any valid point with the same simulated
 * address, without calling any external service.
 */
export class MockGeocodingProvider implements GeocodingProvider {
  async geocode(address: string): Promise<Result<GeocodingResultDTO | null>> {
    if (typeof address !== 'string' || !address.trim()) {
      return Result.fail<GeocodingResultDTO | null>(GeocodingErrors.GEOCODING_ADDRESS_REQUIRED);
    }
    return Result.ok<GeocodingResultDTO | null>({ ...MOCK_GEOCODING_RESULT });
  }

  async reverseGeocode(point: {
    latitude: number;
    longitude: number;
  }): Promise<Result<AddressSuggestionDTO | null>> {
    const geoPoint = GeoPoint.tryCreate(point);
    if (geoPoint.isFailure) {
      return Result.fail<AddressSuggestionDTO | null>(GeocodingErrors.GEOCODING_LOCATION_INVALID);
    }
    return Result.ok<AddressSuggestionDTO | null>({
      latitude: geoPoint.instance.latitude,
      longitude: geoPoint.instance.longitude,
      ...MOCK_ADDRESS_SUGGESTION,
    });
  }
}
