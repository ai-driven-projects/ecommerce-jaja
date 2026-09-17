import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP da geocodificação (`/geocoding`), para qualquer usuário
 * autenticado: o cadastro de loja localiza o endereço de referência e "Minha
 * conta" localiza o endereço digitado e sugere o endereço de um ponto do mapa.
 * A chave do Google fica no backend; sem ela a API responde sempre com dados
 * simulados (`source: 'mock'`).
 */

/** Aviso exibido quando o backend responde a busca com dados simulados (`source: 'mock'`). */
export const MOCK_GEOCODING_WARNING = 'Busca de endereço simulada: o backend está sem GOOGLE_MAPS_API_KEY';

/** Resultado de `GET /geocoding` (`GeocodingResultDTO`). */
export type GeocodingResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  /** `'mock'` quando o backend está sem `GOOGLE_MAPS_API_KEY`. */
  source: 'google' | 'mock';
};

/**
 * Endereço sugerido para um ponto (`GET /geocoding/reverse`, `AddressSuggestionDTO`).
 * `latitude`/`longitude` são as do ponto consultado (6 casas), não as do
 * resultado do provedor. Cada componente é `null` quando o provedor não o traz
 * ou ele está fora do formato: `zipCode` só com 8 dígitos e `state` como sigla
 * de 2 letras maiúsculas.
 */
export type AddressSuggestion = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  /** `'mock'` quando o backend está sem `GOOGLE_MAPS_API_KEY` (sempre a Avenida Paulista, 1578). */
  source: 'google' | 'mock';
};

/** Ponto do mapa em graus decimais. */
export type GeocodingPoint = {
  latitude: number;
  longitude: number;
};

/**
 * Coordenadas de um endereço em texto livre. Falhas: `400
 * GEOCODING_ADDRESS_REQUIRED` (menos de 3 caracteres), `404
 * GEOCODING_ADDRESS_NOT_FOUND` e `503 GEOCODING_UNAVAILABLE`.
 */
export function geocodeAddress(token: string, address: string): Promise<GeocodingResult> {
  const params = new URLSearchParams({ address: address.trim() });
  return apiRequest<GeocodingResult>(`/geocoding?${params.toString()}`, { token });
}

/**
 * Endereço mais próximo de um ponto. Falhas: `400 GEOCODING_LOCATION_INVALID`
 * (ponto fora dos limites), `404 GEOCODING_ADDRESS_NOT_FOUND` (nenhum endereço
 * para o ponto) e `503 GEOCODING_UNAVAILABLE`.
 */
export function reverseGeocode(token: string, { latitude, longitude }: GeocodingPoint): Promise<AddressSuggestion> {
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
  return apiRequest<AddressSuggestion>(`/geocoding/reverse?${params.toString()}`, { token });
}
