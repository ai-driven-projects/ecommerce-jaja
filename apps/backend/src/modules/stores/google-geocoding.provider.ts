import { Logger } from '@nestjs/common';
import { Result } from '@mentoria-360/shared';
import { GeoPoint, GeocodingErrors } from '@jaja/stores';
import type { GeocodingProvider, GeocodingResultDTO } from '@jaja/stores';

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const TIMEOUT_MS = 5000;

type GoogleGeocodingResponse = {
  status?: string;
  error_message?: string;
  results?: {
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }[];
};

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

    const params = new URLSearchParams({
      address: value,
      key: this.apiKey,
      language: 'pt-BR',
      region: 'br',
    });

    let httpStatus: number;
    let body: GoogleGeocodingResponse;
    try {
      const response = await fetch(`${GEOCODING_URL}?${params.toString()}`, {
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

    if (status === 'ZERO_RESULTS') return Result.ok<GeocodingResultDTO | null>(null);
    if (status !== 'OK') return this.unavailable(status, body?.error_message);

    const first = body.results?.[0];
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

  private unavailable(status: string, message?: string): Result<GeocodingResultDTO | null> {
    const details = message ? ` message="${this.redact(message)}"` : '';
    this.logger.error(`Google Geocoding unavailable: status=${this.redact(status)}${details}`);
    return Result.fail<GeocodingResultDTO | null>(GeocodingErrors.GEOCODING_UNAVAILABLE);
  }

  private redact(text: string): string {
    return this.apiKey ? text.split(this.apiKey).join('[REDACTED]') : text;
  }
}
