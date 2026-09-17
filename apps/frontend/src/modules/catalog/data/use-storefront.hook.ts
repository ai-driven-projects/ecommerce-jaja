'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { storePlaceOf } from '@/modules/stores/data/store-address.util';
import type { StorefrontStore } from '@/modules/stores/data/storefront-store.api';
import { useStorefrontStores } from '@/modules/stores/data/use-storefront-stores.hook';
import { useLocalStorage } from '@/shared/hooks/use-local-storage.hook';
import { withQuery } from '@/shared/navigation/with-query.util';
import {
  buildStorefrontHref,
  buildStorefrontQuery,
  parseStorefrontParams,
  storefrontBaseParams,
  type StorefrontParamChanges,
} from './storefront-query.util';

/** Chave da loja escolhida no navegador (só o slug, nunca enviado à API). */
export const STOREFRONT_STORE_STORAGE_KEY = 'jaja:vitrine:loja';

/** O slug vai e volta do `localStorage` como texto puro, sem JSON. */
const SLUG_STORAGE = {
  serialize: (slug: string) => slug,
  deserialize: (raw: string) => raw,
};

/**
 * Loja da vitrine com a cidade e a UF já lidas do endereço de referência, para
 * o seletor do cabeçalho e os padrões dos formulários de entrega.
 */
export type StorefrontStoreWithPlace = StorefrontStore & {
  /** Cidade da loja; `null` quando o endereço não termina em `Cidade/UF`. */
  city: string | null;
  /** UF da loja; `null` quando o endereço não termina em `Cidade/UF`. */
  state: string | null;
};

function withPlace(store: StorefrontStore): StorefrontStoreWithPlace {
  const place = storePlaceOf(store.address);
  return { ...store, city: place?.city ?? null, state: place?.state ?? null };
}

export type StorefrontNavigateOptions = {
  /** Força o modo do histórico; o padrão é `push` para página e busca e `replace` para o resto. */
  history?: 'push' | 'replace';
};

/**
 * Estado da vitrine com a URL como fonte de verdade (`parseStorefrontParams`).
 * As lojas são as ativas de `GET /storefront/stores`, e a loja em vigor sai,
 * nesta ordem, de `loja` na URL, da escolha lembrada no navegador (descartada
 * quando a loja não está mais ativa) e da primeira loja ativa. `setStore`
 * grava o slug na URL sem entrada no histórico e lembra a escolha; `city` e
 * `state` vêm do fim do endereço da loja (paliativo de `storePlaceOf`).
 *
 * `navigate` leva à vitrine com as mudanças: filtros, categoria e ordem usam
 * `router.replace` sem rolar; página e busca usam `router.push`. `query`
 * preserva todos os parâmetros e vai nos links dos cards e do checkout. O
 * carrinho não passa por aqui: vive em `useCart` (`modules/orders/data/cart.context`).
 * A memoização fica a cargo do React Compiler.
 */
export function useStorefront() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stores: activeStores, loading: loadingStores } = useStorefrontStores();
  const [rememberedSlug, rememberStore] = useLocalStorage<string>(STOREFRONT_STORE_STORAGE_KEY, '', SLUG_STORAGE);

  const params = parseStorefrontParams(searchParams);

  const stores = activeStores.map(withPlace);

  const bySlug = (slug: string | null): StorefrontStoreWithPlace | null =>
    slug ? (stores.find((store) => store.slug === slug) ?? null) : null;

  // URL → escolha lembrada (só se a loja continuar ativa) → primeira loja ativa.
  const store = bySlug(params.storeSlug) ?? bySlug(rememberedSlug || null) ?? stores[0] ?? null;

  const navigate = (changes: StorefrontParamChanges, options: StorefrontNavigateOptions = {}) => {
    const href = buildStorefrontHref(params, changes);
    const history = options.history ?? ('page' in changes || 'search' in changes ? 'push' : 'replace');

    if (history === 'push') router.push(href, { scroll: 'search' in changes });
    else router.replace(href, { scroll: false });
  };

  // Troca só a loja, na rota atual (vitrine, detalhe, acesso ou "Minha conta"),
  // sem mexer nos outros parâmetros e sem entrada no histórico. A escolha fica
  // lembrada para as próximas visitas sem `loja` na URL.
  const setStore = (slug: string) => {
    rememberStore(slug);
    const next = new URLSearchParams(searchParams.toString());
    next.set('loja', slug);
    router.replace(withQuery(pathname, next.toString()), { scroll: false });
  };

  const setCategory = (value: string) => navigate({ category: value });

  /** Busca pelo cabeçalho: `q` com a loja atual, descartando os demais filtros; vazio remove `q`. */
  const searchProducts = (term: string) => navigate({ ...storefrontBaseParams(params), search: term });

  return {
    params,
    category: params.category,
    navigate,
    setCategory,
    searchProducts,
    /** Loja em vigor; `null` enquanto as lojas carregam ou sem nenhuma loja ativa. */
    store,
    /** Slug da loja em vigor (o do seed), casado com `GET /storefront/stores`. */
    storeSlug: store?.slug ?? null,
    /** Lojas ativas na ordem da API (por nome), com cidade e UF lidas do endereço. */
    stores,
    loadingStores,
    setStore,
    /** Cidade e UF lidas do endereço da loja em vigor; `null` fora do formato `Cidade/UF`. */
    city: store?.city ?? null,
    state: store?.state ?? null,
    query: buildStorefrontQuery(params),
  };
}
