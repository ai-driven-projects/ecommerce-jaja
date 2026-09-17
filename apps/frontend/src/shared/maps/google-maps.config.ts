/**
 * Configuração do Google Maps no frontend, compartilhada pelos mapas da loja
 * (cadastro de loja) e do cliente ("Minha conta"). As casas decimais repetem as
 * do domínio (`GeoPoint` de `@jaja/stores` e `CustomerLocation` de
 * `@jaja/customers`), porque o frontend não importa pacotes `@jaja/*`.
 */

/** Chave pública do Maps JavaScript API; vazia liga o mapa simulado. */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

/** Map ID dos marcadores avançados; sem valor usa o `DEMO_MAP_ID` do Google. */
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID';

/** Aviso exibido quando a chave pública existe, mas o Google Maps não carregou. */
export const GOOGLE_MAPS_LOAD_ERROR_MESSAGE =
  'Não foi possível carregar o Google Maps (chave recusada ou sem conexão). Usando o mapa simulado.';

/** Há chave pública: a tela tenta carregar o Google Maps. */
export const isGoogleMapsConfigured = GOOGLE_MAPS_API_KEY !== '';

/** Casas decimais das coordenadas (≈ 11 cm), as mesmas do domínio. */
export const COORDINATE_DECIMALS = 6;

/** Coordenada arredondada para 6 casas (`-3.73561234` → `-3.735612`). */
export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}
