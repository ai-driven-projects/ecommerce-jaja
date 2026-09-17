import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { GeocodingErrors } from '@jaja/stores';
import type {
  AddressSuggestionDTO,
  GeocodingProvider,
  GeocodingResultDTO,
} from '@jaja/stores';
import { JwtGuard } from '../../shared/auth/jwt.guard.js';
import { GEOCODING_PROVIDER } from './geocoding-provider.token.js';

const MIN_ADDRESS_LENGTH = 3;

// Geocoding for any authenticated user, administrator or not: the store form
// and the customer's "Minha conta" page use it. A valid token is still required
// (`401` without it, before any call to the provider), and the provider key
// never leaves the server.
@Controller('geocoding')
@UseGuards(JwtGuard)
export class GeocodingController {
  constructor(
    @Inject(GEOCODING_PROVIDER)
    private readonly geocodingProvider: GeocodingProvider,
  ) {}

  // Read-only lookups: both call the provider directly, without a use case.
  @Get()
  async geocode(@Query('address') address?: unknown): Promise<GeocodingResultDTO> {
    const value = typeof address === 'string' ? address.trim() : '';
    if (value.length < MIN_ADDRESS_LENGTH) {
      throw new BadRequestException([GeocodingErrors.GEOCODING_ADDRESS_REQUIRED]);
    }

    const result = await this.geocodingProvider.geocode(value);

    if (result.isFailure) {
      throw new ServiceUnavailableException([GeocodingErrors.GEOCODING_UNAVAILABLE]);
    }
    if (!result.instance) {
      throw new NotFoundException([GeocodingErrors.GEOCODING_ADDRESS_NOT_FOUND]);
    }
    return result.instance;
  }

  // Suggests the address closest to a point of the map. The limits of the
  // coordinates are checked by the provider (`GeoPoint`), before any external call.
  @Get('reverse')
  async reverse(
    @Query('latitude') latitude?: unknown,
    @Query('longitude') longitude?: unknown,
  ): Promise<AddressSuggestionDTO> {
    const lat = this.coordinate(latitude);
    const lng = this.coordinate(longitude);
    if (lat === null || lng === null) {
      throw new BadRequestException([GeocodingErrors.GEOCODING_LOCATION_INVALID]);
    }

    const result = await this.geocodingProvider.reverseGeocode({ latitude: lat, longitude: lng });

    if (result.isFailure) {
      if (result.errors.includes(GeocodingErrors.GEOCODING_LOCATION_INVALID)) {
        throw new BadRequestException([GeocodingErrors.GEOCODING_LOCATION_INVALID]);
      }
      throw new ServiceUnavailableException([GeocodingErrors.GEOCODING_UNAVAILABLE]);
    }
    if (!result.instance) {
      throw new NotFoundException([GeocodingErrors.GEOCODING_ADDRESS_NOT_FOUND]);
    }
    return result.instance;
  }

  // A finite number from a query parameter; `null` when it is missing, blank,
  // repeated or not numeric. Blank is rejected before `Number()`, which turns
  // `''` into `0`.
  private coordinate(value: unknown): number | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
}
