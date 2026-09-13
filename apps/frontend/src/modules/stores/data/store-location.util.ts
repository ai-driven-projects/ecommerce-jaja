/**
 * Localização da loja no frontend: configuração do Google Maps, o ponto
 * simulado e os limites do raio. Os valores repetem os do domínio
 * (`@jaja/stores`) e do `MockGeocodingProvider` do backend, porque o frontend
 * não importa pacotes `@jaja/*`.
 */

/** Chave pública do Maps JavaScript API; vazia liga o mapa simulado. */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

/** Map ID dos marcadores avançados; sem valor usa o `DEMO_MAP_ID` do Google. */
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';

/** Há chave pública: o formulário tenta carregar o Google Maps. */
export const isGoogleMapsConfigured = GOOGLE_MAPS_API_KEY !== '';

export const STORE_MIN_DELIVERY_RADIUS_METERS = 300;
export const STORE_MAX_DELIVERY_RADIUS_METERS = 10000;
export const STORE_DEFAULT_DELIVERY_RADIUS_METERS = 1000;

/** Passo do raio gravado a partir do círculo do mapa. */
export const STORE_RADIUS_STEP_METERS = 50;

/** Casas decimais das coordenadas (≈ 11 cm), as mesmas do `GeoPoint` do domínio. */
export const STORE_COORDINATE_DECIMALS = 6;

/** Ponto e raio simulados: Avenida Paulista, 1578 (em frente ao MASP), raio de 1 km. */
export const STORE_MOCK_LOCATION = {
  latitude: -23.561414,
  longitude: -46.655881,
  deliveryRadiusMeters: 1000,
  label: 'Avenida Paulista, 1578 – Bela Vista, São Paulo/SP',
} as const;

/** Coordenada arredondada para 6 casas (`-3.73561234` → `-3.735612`). */
export function roundCoordinate(value: number): number {
  const factor = 10 ** STORE_COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Raio vindo do mapa: múltiplo de 50 m, limitado a 300–10.000 m
 * (`1230` → `1250`, `120` → `300`, `12000` → `10000`). Valor não finito vira o padrão.
 */
export function normalizeRadius(meters: number): number {
  if (!Number.isFinite(meters)) return STORE_DEFAULT_DELIVERY_RADIUS_METERS;

  const stepped = Math.round(meters / STORE_RADIUS_STEP_METERS) * STORE_RADIUS_STEP_METERS;
  return Math.min(STORE_MAX_DELIVERY_RADIUS_METERS, Math.max(STORE_MIN_DELIVERY_RADIUS_METERS, stepped));
}

const METERS_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const KILOMETERS_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Raio para exibição: `"800 m"`, `"1 km"`, `"2,5 km"`. */
export function formatRadius(meters: number): string {
  if (meters < 1000) return `${METERS_FORMAT.format(meters)} m`;
  return `${KILOMETERS_FORMAT.format(meters / 1000)} km`;
}
