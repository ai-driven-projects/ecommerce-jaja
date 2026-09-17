import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockGeocodingProvider } from './mock-geocoding.provider.js';

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
});
