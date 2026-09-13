import { Logger } from '@nestjs/common';
import { GeocodingErrors } from '@jaja/stores';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleGeocodingProvider } from './google-geocoding.provider.js';

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
});
