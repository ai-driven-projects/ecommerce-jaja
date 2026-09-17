import { Logger } from '@nestjs/common';
import { GeocodingErrors } from '@jaja/stores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleGeocodingProvider } from '../../../src/modules/stores/google-geocoding.provider.js';

const API_KEY = 'test-secret-key-123';
const LOG_LEVELS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GoogleGeocodingProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logged: string[];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    logged = [];
    for (const level of LOG_LEVELS) {
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: any[]) => {
        logged.push(args.map((arg) => String(arg)).join(' '));
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps OK to the first result with coordinates rounded to 6 places', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'OK',
        results: [
          {
            formatted_address: 'Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brasil',
            geometry: { location: { lat: -23.5614141234, lng: -46.6558819876 } },
          },
          {
            formatted_address: 'Outro resultado',
            geometry: { location: { lat: 1, lng: 1 } },
          },
        ],
      }),
    );

    const result = await new GoogleGeocodingProvider(API_KEY).geocode('Avenida Paulista, 1578');

    expect(result.isOk).toBe(true);
    expect(result.instance).toEqual({
      latitude: -23.561414,
      longitude: -46.655882,
      formattedAddress: 'Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brasil',
      source: 'google',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get('address')).toBe('Avenida Paulista, 1578');
    expect(params.get('key')).toBe(API_KEY);
    expect(params.get('language')).toBe('pt-BR');
    expect(params.get('region')).toBe('br');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps ZERO_RESULTS to ok with null', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ZERO_RESULTS', results: [] }));

    const result = await new GoogleGeocodingProvider(API_KEY).geocode('Endereço que não existe');

    expect(result.isOk).toBe(true);
    expect(result.instance).toBeNull();
  });

  it('maps REQUEST_DENIED to GEOCODING_UNAVAILABLE, logging only status and message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'REQUEST_DENIED',
        error_message: `The provided API key is invalid. (${API_KEY})`,
        results: [],
      }),
    );

    const result = await new GoogleGeocodingProvider(API_KEY).geocode('Avenida Paulista, 1578');

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual([GeocodingErrors.GEOCODING_UNAVAILABLE]);
    expect(logged.some((line) => line.includes('REQUEST_DENIED'))).toBe(true);
    expect(logged.some((line) => line.includes('The provided API key is invalid.'))).toBe(true);
    expect(logged.some((line) => line.includes(API_KEY))).toBe(false);
    expect(logged.some((line) => line.includes('maps.googleapis.com'))).toBe(false);
  });

  it('maps a network error to GEOCODING_UNAVAILABLE without logging the key', async () => {
    fetchMock.mockRejectedValue(
      new TypeError(`fetch failed for https://maps.googleapis.com/?key=${API_KEY}`),
    );

    const result = await new GoogleGeocodingProvider(API_KEY).geocode('Avenida Paulista, 1578');

    expect(result.isFailure).toBe(true);
    expect(result.errors).toEqual([GeocodingErrors.GEOCODING_UNAVAILABLE]);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.some((line) => line.includes(API_KEY))).toBe(false);
  });

  it('maps a timeout to GEOCODING_UNAVAILABLE', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    );

    const result = await new GoogleGeocodingProvider(API_KEY).geocode('Avenida Paulista, 1578');

    expect(result.errors).toEqual([GeocodingErrors.GEOCODING_UNAVAILABLE]);
    expect(logged.some((line) => line.includes('TimeoutError'))).toBe(true);
    expect(logged.some((line) => line.includes(API_KEY))).toBe(false);
  });

  describe('reverseGeocode', () => {
    const POINT = { latitude: -23.5614141, longitude: -46.6558809 };

    const PAULISTA_COMPONENTS = [
      { long_name: '1578', short_name: '1578', types: ['street_number'] },
      { long_name: 'Avenida Paulista', short_name: 'Av. Paulista', types: ['route'] },
      {
        long_name: 'Bela Vista',
        short_name: 'Bela Vista',
        types: ['political', 'sublocality', 'sublocality_level_1'],
      },
      { long_name: 'São Paulo', short_name: 'São Paulo', types: ['administrative_area_level_2', 'political'] },
      { long_name: 'São Paulo', short_name: 'SP', types: ['administrative_area_level_1', 'political'] },
      { long_name: 'Brasil', short_name: 'BR', types: ['country', 'political'] },
      { long_name: '01310-200', short_name: '01310-200', types: ['postal_code'] },
    ];

    it('maps the first result components and returns the queried point rounded', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: 'OK',
          results: [
            {
              formatted_address: 'Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brasil',
              geometry: { location: { lat: -23.5613, lng: -46.6559 } },
              address_components: PAULISTA_COMPONENTS,
            },
            {
              formatted_address: 'Outro resultado',
              address_components: [{ long_name: 'Outra rua', types: ['route'] }],
            },
          ],
        }),
      );

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.isOk).toBe(true);
      expect(result.instance).toEqual({
        latitude: -23.561414,
        longitude: -46.655881,
        formattedAddress: 'Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brasil',
        zipCode: '01310200',
        street: 'Avenida Paulista',
        number: '1578',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        source: 'google',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const params = new URL(url).searchParams;
      expect(params.get('latlng')).toBe('-23.561414,-46.655881');
      expect(params.get('key')).toBe(API_KEY);
      expect(params.get('language')).toBe('pt-BR');
      expect(params.get('result_type')).toBe('street_address|premise|route');
      expect(params.has('address')).toBe(false);
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('falls back to neighborhood and locality when the preferred components are missing', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: 'OK',
          results: [
            {
              formatted_address: 'Rua Silva Paulet - Aldeota, Fortaleza - CE',
              address_components: [
                { long_name: 'Rua Silva Paulet', types: ['route'] },
                { long_name: 'Aldeota', types: ['neighborhood', 'political'] },
                { long_name: 'Fortaleza', types: ['locality', 'political'] },
                { long_name: 'Ceará', short_name: 'CE', types: ['administrative_area_level_1'] },
              ],
            },
          ],
        }),
      );

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.instance).toMatchObject({
        street: 'Rua Silva Paulet',
        neighborhood: 'Aldeota',
        city: 'Fortaleza',
        state: 'CE',
        number: null,
        zipCode: null,
      });
    });

    it('returns null for a missing street number, keeping the other components', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: 'OK',
          results: [
            {
              formatted_address: 'Av. Paulista - Bela Vista, São Paulo - SP, 01310-200, Brasil',
              address_components: PAULISTA_COMPONENTS.filter(
                (component) => !component.types.includes('street_number'),
              ),
            },
          ],
        }),
      );

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.isOk).toBe(true);
      expect(result.instance).toMatchObject({
        number: null,
        street: 'Avenida Paulista',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310200',
      });
    });

    it('maps a 5-digit CEP to null', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: 'OK',
          results: [
            {
              formatted_address: 'Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310, Brasil',
              address_components: PAULISTA_COMPONENTS.map((component) =>
                component.types.includes('postal_code')
                  ? { ...component, long_name: '01310', short_name: '01310' }
                  : component,
              ),
            },
          ],
        }),
      );

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.instance).toMatchObject({ zipCode: null, street: 'Avenida Paulista', number: '1578' });
    });

    it('maps ZERO_RESULTS to ok with null', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ status: 'ZERO_RESULTS', results: [] }));

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.isOk).toBe(true);
      expect(result.instance).toBeNull();
    });

    it('maps REQUEST_DENIED to GEOCODING_UNAVAILABLE without the key in the log', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          status: 'REQUEST_DENIED',
          error_message: `The provided API key is invalid. (${API_KEY})`,
          results: [],
        }),
      );

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.isFailure).toBe(true);
      expect(result.errors).toEqual([GeocodingErrors.GEOCODING_UNAVAILABLE]);
      expect(logged.some((line) => line.includes('REQUEST_DENIED'))).toBe(true);
      expect(logged.some((line) => line.includes(API_KEY))).toBe(false);
      expect(logged.some((line) => line.includes('maps.googleapis.com'))).toBe(false);
    });

    it('maps a timeout to GEOCODING_UNAVAILABLE', async () => {
      fetchMock.mockRejectedValue(
        new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
      );

      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(POINT);

      expect(result.errors).toEqual([GeocodingErrors.GEOCODING_UNAVAILABLE]);
      expect(logged.some((line) => line.includes('TimeoutError'))).toBe(true);
      expect(logged.some((line) => line.includes(API_KEY))).toBe(false);
    });

    it.each([
      ['latitude out of range', { latitude: 95, longitude: -46.65 }],
      ['longitude out of range', { latitude: -23.56, longitude: -180.5 }],
      ['NaN', { latitude: Number.NaN, longitude: -46.65 }],
      ['missing longitude', { latitude: -23.56 } as { latitude: number; longitude: number }],
    ])('fails with GEOCODING_LOCATION_INVALID without calling fetch (%s)', async (_, point) => {
      const result = await new GoogleGeocodingProvider(API_KEY).reverseGeocode(point);

      expect(result.isFailure).toBe(true);
      expect(result.errors).toEqual([GeocodingErrors.GEOCODING_LOCATION_INVALID]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
