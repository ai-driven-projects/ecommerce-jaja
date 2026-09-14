'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { listStorefrontCategories, type StorefrontCategory } from './storefront.api';

const NO_CATEGORIES: StorefrontCategory[] = [];

type CategoriesState = {
  categories: StorefrontCategory[];
  failed: boolean;
};

/**
 * Árvore de categorias da loja, carregada uma vez por montagem. Use pelo
 * `StorefrontCatalogProvider` do shell, que a compartilha entre cabeçalho,
 * vitrine e detalhe. Falha vira toaster e a árvore fica vazia.
 */
export function useStorefrontCategories() {
  const [state, setState] = useState<CategoriesState | null>(null);

  useEffect(() => {
    let cancelled = false;

    listStorefrontCategories()
      .then((categories) => {
        if (!cancelled) setState({ categories, failed: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setState({ categories: NO_CATEGORIES, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    categories: state?.categories ?? NO_CATEGORIES,
    loading: state === null,
    failed: state?.failed ?? false,
  };
}
