import { apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP da leitura pública das lojas pela vitrine
 * (`GET /storefront/stores`, sem token): só lojas ativas, sem telefone, status
 * nem datas.
 */

/** Loja da vitrine (`StorefrontStoreDTO`), com o ponto em 6 casas decimais. */
export type StorefrontStore = {
  id: string;
  name: string;
  slug: string;
  /** Endereço de referência da loja, ou `null`. */
  address: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusMeters: number;
};

/** Lojas ativas, ordenadas pelo nome. */
export function listStorefrontStores(): Promise<StorefrontStore[]> {
  return apiRequest<StorefrontStore[]>('/storefront/stores');
}
