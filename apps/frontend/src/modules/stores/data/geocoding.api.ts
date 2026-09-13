import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP da geocodificação (`/geocoding`, só administradores). A chave do
 * Google fica no backend; sem ela a API responde sempre o ponto simulado.
 */

/** Resultado de `GET /geocoding` (`GeocodingResultDTO`). */
export type GeocodingResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  /** `'mock'` quando o backend está sem `GOOGLE_MAPS_API_KEY`. */
  source: 'google' | 'mock';
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
