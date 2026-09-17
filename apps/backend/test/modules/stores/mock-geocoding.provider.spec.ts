import { GeocodingErrors } from '@jaja/stores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockGeocodingProvider } from '../../../src/modules/stores/mock-geocoding.provider.js';

const SIMULATED_POINT = {
  latitude: -23.561414,
  longitude: -46.655881,
  formattedAddress: 'Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200',
  source: 'mock',
};

describe('MockGeocodingProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('always answers the same simulated point without calling fetch', async () => {
    const provider = new MockGeocodingProvider();

    const fortaleza = await provider.geocode('Rua Silva Paulet, 1100, Fortaleza');
    const saoPaulo = await provider.geocode('Avenida Paulista, 1578, São Paulo');

    expect(fortaleza.isOk).toBe(true);
    expect(fortaleza.instance).toEqual(SIMULATED_POINT);
    expect(saoPaulo.instance).toEqual(SIMULATED_POINT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('reverseGeocode', () => {
    it('returns the queried point rounded with the simulated address, without calling fetch', async () => {
      const result = await new MockGeocodingProvider().reverseGeocode({
        latitude: -22.9068471,
        longitude: -43.1728969,
      });

      expect(result.isOk).toBe(true);
      expect(result.instance).toEqual({
        latitude: -22.906847,
        longitude: -43.172897,
        formattedAddress: SIMULATED_POINT.formattedAddress,
        zipCode: '01310200',
        street: 'Avenida Paulista',
        number: '1578',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        source: 'mock',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['latitude out of range', { latitude: 95, longitude: -46.65 }],
      ['Infinity', { latitude: -23.56, longitude: Number.POSITIVE_INFINITY }],
      ['missing longitude', { latitude: -23.56 } as { latitude: number; longitude: number }],
    ])('fails with GEOCODING_LOCATION_INVALID for an invalid point (%s)', async (_, point) => {
      const result = await new MockGeocodingProvider().reverseGeocode(point);

      expect(result.isFailure).toBe(true);
      expect(result.errors).toEqual([GeocodingErrors.GEOCODING_LOCATION_INVALID]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
