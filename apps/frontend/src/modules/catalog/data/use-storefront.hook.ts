'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { withQuery } from '@/shared/navigation/with-query.util';
import { ETA_BY_NEIGHBORHOOD, UNSERVED_NEIGHBORHOODS, ZONES, storeOf } from './storefront.mock';
import {
  DEFAULT_NEIGHBORHOOD,
  buildStorefrontHref,
  buildStorefrontQuery,
  parseStorefrontParams,
  storefrontBaseParams,
  type StorefrontParamChanges,
} from './storefront-query.util';

/** Bairros atendidos agrupados por loja, na ordem de `ZONES`: `[loja, bairros[]][]`. */
export function groupNeighborhoodsByStore(): [string, string[]][] {
  const byStore = new Map<string, string[]>();
  for (const zone of ZONES) {
    byStore.set(zone.store, [...(byStore.get(zone.store) ?? []), zone.neighborhood]);
  }
  return [...byStore.entries()];
}

const SERVED_NEIGHBORHOODS = ZONES.map((zone) => zone.neighborhood);
const STORES = groupNeighborhoodsByStore();

export type StorefrontNavigateOptions = {
  /** Força o modo do histórico; o padrão é `push` para página e busca e `replace` para o resto. */
  history?: 'push' | 'replace';
};

/**
 * Estado da vitrine com a URL como fonte de verdade (`parseStorefrontParams`).
 * O bairro continua simulado (ETA, loja e bairros atendidos vêm do mock).
 * `navigate` leva à vitrine com as mudanças: filtros, categoria e ordem usam
 * `router.replace` sem rolar; página e busca usam `router.push`. `query`
 * preserva todos os parâmetros e vai nos links dos cards e do checkout. O
 * carrinho vive em `useCart`. A memoização fica a cargo do React Compiler.
 */
export function useStorefront() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = parseStorefrontParams(searchParams);
  const neighborhood = params.neighborhood ?? DEFAULT_NEIGHBORHOOD;

  const navigate = (changes: StorefrontParamChanges, options: StorefrontNavigateOptions = {}) => {
    const href = buildStorefrontHref(params, changes);
    const history = options.history ?? ('page' in changes || 'search' in changes ? 'push' : 'replace');

    if (history === 'push') router.push(href, { scroll: 'search' in changes });
    else router.replace(href, { scroll: false });
  };

  // Troca só o bairro, na rota atual (vitrine, detalhe ou acesso), sem mexer nos outros parâmetros.
  const setNeighborhood = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('bairro', value);
    router.replace(withQuery(pathname, next.toString()), { scroll: false });
  };

  const setCategory = (value: string) => navigate({ category: value });

  /** Busca pelo cabeçalho: `q` com o bairro atual, descartando os demais filtros; vazio remove `q`. */
  const searchProducts = (term: string) => navigate({ ...storefrontBaseParams(params), search: term });

  const served = SERVED_NEIGHBORHOODS.includes(neighborhood);
  const etaMinutes = served ? (ETA_BY_NEIGHBORHOOD[neighborhood] ?? null) : null;
  const store = storeOf(neighborhood);

  // Seletor: atendidos, depois não atendidos. Um bairro desconhecido vindo da
  // URL entra no fim para o seletor não mostrar outro bairro no lugar.
  const known = [...SERVED_NEIGHBORHOODS, ...UNSERVED_NEIGHBORHOODS];
  const neighborhoods = known.includes(neighborhood) ? known : [...known, neighborhood];

  return {
    params,
    neighborhood,
    category: params.category,
    navigate,
    setNeighborhood,
    setCategory,
    searchProducts,
    served,
    etaMinutes,
    store,
    stores: STORES,
    neighborhoods,
    servedNeighborhoods: SERVED_NEIGHBORHOODS,
    query: buildStorefrontQuery(params),
  };
}
