import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeocodingErrors } from '@jaja/stores';
import type { GeocodingProvider, GeocodingResultDTO } from '@jaja/stores';
import { AdminOnly } from '../../shared/decorators/admin-only.decorator.js';
import { GEOCODING_PROVIDER } from './geocoding-provider.token.js';

const MIN_ADDRESS_LENGTH = 3;

@Controller('geocoding')
@AdminOnly()
export class GeocodingController {
  constructor(
    @Inject(GEOCODING_PROVIDER)
    private readonly geocodingProvider: GeocodingProvider,
  ) {}

  // Read-only lookup: calls the provider directly, without a use case.
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
}
