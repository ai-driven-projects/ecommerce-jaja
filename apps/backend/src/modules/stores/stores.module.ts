import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeocodingProvider } from '@jaja/stores';
import { DbModule } from '../../db/db.module.js';
import { GeocodingController } from './geocoding.controller.js';
import { GEOCODING_PROVIDER } from './geocoding-provider.token.js';
import { GoogleGeocodingProvider } from './google-geocoding.provider.js';
import { MockGeocodingProvider } from './mock-geocoding.provider.js';
import { StoreController } from './store.controller.js';
import { StorePrisma } from './store.prisma.js';

@Module({
  imports: [DbModule],
  controllers: [StoreController, GeocodingController],
  providers: [
    StorePrisma,
    {
      // Google with `GOOGLE_MAPS_API_KEY` set; otherwise the simulated point.
      // The factory runs once, so the warning is logged once at startup.
      provide: GEOCODING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): GeocodingProvider => {
        const apiKey = config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
        if (apiKey) return new GoogleGeocodingProvider(apiKey);

        new Logger('StoresModule').warn(
          'GOOGLE_MAPS_API_KEY is empty: geocoding is simulated and always answers ' +
            'Avenida Paulista, 1578 - São Paulo/SP (source "mock").',
        );
        return new MockGeocodingProvider();
      },
    },
  ],
  exports: [StorePrisma],
})
export class StoresModule {}
