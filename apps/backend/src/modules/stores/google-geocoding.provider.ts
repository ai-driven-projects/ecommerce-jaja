import { Logger } from '@nestjs/common';
import { Result } from '@mentoria-360/shared';
import { GeoPoint, GeocodingErrors } from '@jaja/stores';
import type {
  AddressSuggestionDTO,
  GeocodingProvider,
  GeocodingResultDTO,
} from '@jaja/stores';

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const TIMEOUT_MS = 5000;
// Reverse geocoding only suggests addresses precise enough for a delivery:
// never a whole neighborhood or city.
const REVERSE_RESULT_TYPES = 'street_address|premise|route';

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodingResult = {
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: GoogleAddressComponent[];
};

type GoogleGeocodingResponse = {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodingResult[];
};

type Point = { latitude: number; longitude: number };

/**
 * Geocoding API adapter. The request URL carries the secret key, so neither the
 * URL nor the raw error is ever logged: failures log only the status and the
 * message returned by Google (with the key redacted, just in case).
 */
export class GoogleGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger(GoogleGeocodingProvider.name);

  constructor(private readonly apiKey: string) {}

  async geocode(address: string): Promise<Result<GeocodingResultDTO | null>> {
    const value = typeof address === 'string' ? address.trim() : '';
    if (!value) {
      return Result.fail<GeocodingResultDTO | null>(GeocodingErrors.GEOCODING_ADDRESS_REQUIRED);
    }

    const response = await this.request({ address: value, language: 'pt-BR', region: 'br' });
    if (response.isFailure) return Result.fail<GeocodingResultDTO | null>(response.errors);

    const first = response.instance;
    const location = first?.geometry?.location;
    if (!first || typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
      return Result.ok<GeocodingResultDTO | null>(null);
    }

    return Result.ok<GeocodingResultDTO | null>({
      latitude: GeoPoint.round(location.lat),
      longitude: GeoPoint.round(location.lng),
      formattedAddress: first.formatted_address ?? value,
      source: 'google',
    });
  }

  // The suggestion carries the queried point (rounded), not the coordinates of
  // Google's result: the marker placed by the user is the truth.
  async reverseGeocode(point: Point): Promise<Result<AddressSuggestionDTO | null>> {
    const geoPoint = GeoPoint.tryCreate(point);
    if (geoPoint.isFailure) {
      return Result.fail<AddressSuggestionDTO | null>(GeocodingErrors.GEOCODING_LOCATION_INVALID);
    }
    const { latitude, longitude } = geoPoint.instance;

    const response = await this.request({
      latlng: `${latitude},${longitude}`,
      language: 'pt-BR',
      result_type: REVERSE_RESULT_TYPES,
    });
    if (response.isFailure) return Result.fail<AddressSuggestionDTO | null>(response.errors);

    const first = response.instance;
    if (!first) return Result.ok<AddressSuggestionDTO | null>(null);

    const components = first.address_components ?? [];
    const zipCode = this.component(components, ['postal_code'])?.replace(/-/g, '') ?? null;
    const state = this.component(components, ['administrative_area_level_1'], 'short_name');

    return Result.ok<AddressSuggestionDTO | null>({
      latitude,
      longitude,
      formattedAddress: first.formatted_address ?? `${latitude},${longitude}`,
      zipCode: zipCode && /^\d{8}$/.test(zipCode) ? zipCode : null,
      street: this.component(components, ['route']),
      number: this.component(components, ['street_number']),
      neighborhood: this.component(components, ['sublocality_level_1', 'sublocality', 'neighborhood']),
      city: this.component(components, ['administrative_area_level_2', 'locality']),
      state: state && /^[A-Za-z]{2}$/.test(state) ? state.toUpperCase() : null,
      source: 'google',
    });
  }

  /**
   * Calls the Geocoding API with the key and a 5 second timeout, shared by
   * `geocode` and `reverseGeocode`. Resolves to the first result, or to `null`
   * on `ZERO_RESULTS` (or an `OK` without results). A network error, timeout,
   * body that is not JSON or any other status fails with
   * `GEOCODING_UNAVAILABLE`, logging only the status and Google's message.
   */
  private async request(
    params: Record<string, string>,
  ): Promise<Result<GoogleGeocodingResult | null>> {
    const query = new URLSearchParams({ ...params, key: this.apiKey });

    let httpStatus: number;
    let body: GoogleGeocodingResponse;
    try {
      const response = await fetch(`${GEOCODING_URL}?${query.toString()}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      httpStatus = response.status;
      body = (await response.json()) as GoogleGeocodingResponse;
    } catch (error) {
      // Network error, timeout (`TimeoutError`) or a body that is not JSON.
      const status = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
      return this.unavailable(status);
    }

    const status = typeof body?.status === 'string' ? body.status : `HTTP_${httpStatus}`;

    if (status === 'ZERO_RESULTS') return Result.ok<GoogleGeocodingResult | null>(null);
    if (status !== 'OK') return this.unavailable(status, body?.error_message);

    return Result.ok<GoogleGeocodingResult | null>(body.results?.[0] ?? null);
  }

  // The first component having one of `types`, tried in order (the fallback
  // order), trimmed; `null` when none has a non-blank value.
  private component(
    components: GoogleAddressComponent[],
    types: string[],
    name: 'long_name' | 'short_name' = 'long_name',
  ): string | null {
    for (const type of types) {
      const value = components.find((item) => item.types?.includes(type))?.[name];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private unavailable(status: string, message?: string): Result<GoogleGeocodingResult | null> {
    const details = message ? ` message="${this.redact(message)}"` : '';
    this.logger.error(`Google Geocoding unavailable: status=${this.redact(status)}${details}`);
    return Result.fail<GoogleGeocodingResult | null>(GeocodingErrors.GEOCODING_UNAVAILABLE);
  }

  private redact(text: string): string {
    return this.apiKey ? text.split(this.apiKey).join('[REDACTED]') : text;
  }
}
