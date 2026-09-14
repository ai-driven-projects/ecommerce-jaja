'use client';

import { useEffect, useState } from 'react';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { listStorefrontProducts, type StorefrontProductFilter, type StorefrontProductPage } from './storefront.api';

type ProductsResult = {
  /** Chave da requisição que produziu o resultado (filtro + recarga). */
  key: string;
  data: StorefrontProductPage | null;
  error: string | null;
};

export type UseStorefrontProductsOptions = {
  /** Chamado quando a página pedida passa da última; recebe a última existente. */
  onPageOutOfRange?: (lastPage: number) => void;
};

/**
 * Página de produtos da loja para o filtro. A requisição é identificada pela
 * chave do filtro: `loading` vale `true` enquanto a página exibida não
 * corresponde a ela, e a página anterior continua em `data` durante a troca
 * (sem piscar). `error` traz a mensagem da falha da chave atual e `reload`
 * tenta de novo. Página além da última chama `onPageOutOfRange`.
 */
export function useStorefrontProducts(filter: StorefrontProductFilter, { onPageOutOfRange }: UseStorefrontProductsOptions = {}) {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<ProductsResult | null>(null);

  const filterKey = JSON.stringify(filter);
  const requestKey = `${filterKey}|${reloadCount}`;
  const loading = result?.key !== requestKey;
  const data = result?.data ?? null;
  const error = !loading && result ? result.error : null;

  useEffect(() => {
    let cancelled = false;

    listStorefrontProducts(JSON.parse(filterKey) as StorefrontProductFilter)
      .then((page) => {
        if (!cancelled) setResult({ key: requestKey, data: page, error: null });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setResult((previous) => ({ key: requestKey, data: previous?.data ?? null, error: toErrorMessage(failure) }));
      });

    return () => {
      cancelled = true;
    };
  }, [filterKey, requestKey]);

  const requestedPage = filter.page ?? 1;
  const lastPage = Math.max(1, data?.totalPages ?? 1);
  const pageOutOfRange = !loading && error === null && data !== null && requestedPage > lastPage;

  useEffect(() => {
    if (pageOutOfRange) onPageOutOfRange?.(lastPage);
  }, [pageOutOfRange, lastPage, onPageOutOfRange]);

  return {
    data,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    brandFacets: data?.brandFacets ?? [],
    loading,
    error,
    reload: () => setReloadCount((count) => count + 1),
  };
}
