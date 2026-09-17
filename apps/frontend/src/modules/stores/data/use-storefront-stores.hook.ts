'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { listStorefrontStores, type StorefrontStore } from './storefront-store.api';

/**
 * Carga única por aba: a vitrine chama este hook em vários lugares (cabeçalho,
 * grades, detalhe, checkout, "Minha conta"), e a lista de lojas ativas é a
 * mesma para todos. A primeira montagem dispara a requisição; as demais
 * aproveitam a resposta já pedida. A falha vira um toaster só (não um por
 * componente) e lista vazia.
 */
let loadedStores: StorefrontStore[] | null = null;
let pendingStores: Promise<StorefrontStore[]> | null = null;

function loadStorefrontStores(): Promise<StorefrontStore[]> {
  pendingStores ??= listStorefrontStores()
    .then((stores) => {
      loadedStores = stores;
      return stores;
    })
    .catch((error: unknown) => {
      // Sem cache: a próxima montagem tenta de novo.
      pendingStores = null;
      toast.error(toErrorMessage(error));
      return [];
    });

  return pendingStores;
}

/**
 * Lojas ativas da vitrine (`GET /storefront/stores`). `loading` vale `true`
 * até a resposta chegar. `findBySlug` casa a loja em vigor da vitrine
 * (`useStorefront().storeSlug`) e devolve `null` sem slug ou sem loja com ele.
 */
export function useStorefrontStores() {
  const [stores, setStores] = useState<StorefrontStore[] | null>(loadedStores);

  useEffect(() => {
    if (stores !== null) return;

    let cancelled = false;
    loadStorefrontStores().then((next) => {
      if (!cancelled) setStores(next);
    });

    return () => {
      cancelled = true;
    };
  }, [stores]);

  const list = stores ?? [];

  const findBySlug = (slug: string | null | undefined): StorefrontStore | null =>
    slug ? (list.find((store) => store.slug === slug) ?? null) : null;

  return {
    stores: list,
    loading: stores === null,
    findBySlug,
  };
}
