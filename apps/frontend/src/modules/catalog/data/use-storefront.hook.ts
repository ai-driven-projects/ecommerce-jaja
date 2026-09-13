'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ETA_BY_NEIGHBORHOOD, PRODUCTS, UNSERVED_NEIGHBORHOODS, ZONES, hubOf } from './storefront.mock';
import { CATEGORY_ALL, type Product } from './storefront.types';

export const DEFAULT_NEIGHBORHOOD = 'Aldeota';
export const DEFAULT_CATEGORY = CATEGORY_ALL;

/** Query string da vitrine (`bairro` e `categoria`), reutilizada nos links dos cards. */
export function buildStorefrontQuery(neighborhood: string, category: string): string {
  return new URLSearchParams({ bairro: neighborhood, categoria: category }).toString();
}

/** Bairros atendidos agrupados por hub, na ordem de `ZONES`: `[hub, bairros[]][]`. */
export function groupNeighborhoodsByHub(): [string, string[]][] {
  const byHub = new Map<string, string[]>();
  for (const zone of ZONES) {
    byHub.set(zone.hub, [...(byHub.get(zone.hub) ?? []), zone.neighborhood]);
  }
  return [...byHub.entries()];
}

const SERVED_NEIGHBORHOODS = ZONES.map((zone) => zone.neighborhood);
const HUBS = groupNeighborhoodsByHub();

/**
 * Estado da vitrine com a URL como fonte de verdade: `bairro` e `categoria`
 * vêm de `useSearchParams` e são gravados com `router.replace` (sem entrada no
 * histórico e sem scroll). O carrinho vive em `useCart`. A memoização fica a
 * cargo do React Compiler.
 */
export function useStorefront() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const neighborhood = searchParams.get('bairro') ?? DEFAULT_NEIGHBORHOOD;
  const category = searchParams.get('categoria') ?? DEFAULT_CATEGORY;

  const replaceParam = (key: 'bairro' | 'categoria', value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setNeighborhood = (value: string) => replaceParam('bairro', value);
  const setCategory = (value: string) => replaceParam('categoria', value);

  const served = SERVED_NEIGHBORHOODS.includes(neighborhood);
  const etaMinutes = served ? (ETA_BY_NEIGHBORHOOD[neighborhood] ?? null) : null;
  const hub = hubOf(neighborhood);

  const visibleProducts: Product[] = PRODUCTS.filter((product) => category === CATEGORY_ALL || product.category === category);

  // Seletor: atendidos, depois não atendidos. Um bairro desconhecido vindo da
  // URL entra no fim para o seletor não mostrar outro bairro no lugar.
  const known = [...SERVED_NEIGHBORHOODS, ...UNSERVED_NEIGHBORHOODS];
  const neighborhoods = known.includes(neighborhood) ? known : [...known, neighborhood];

  return {
    neighborhood,
    category,
    setNeighborhood,
    setCategory,
    served,
    etaMinutes,
    hub,
    visibleProducts,
    hubs: HUBS,
    neighborhoods,
    servedNeighborhoods: SERVED_NEIGHBORHOODS,
    query: buildStorefrontQuery(neighborhood, category),
  };
}
