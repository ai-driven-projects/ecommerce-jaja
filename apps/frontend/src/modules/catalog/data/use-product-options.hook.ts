'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { listCategories, type CatalogCategory } from './category.api';

/** Opção de `Combobox` (marca pelo nome, categoria pelo caminho completo). */
export type ProductSelectOption = {
  label: string;
  value: string;
};

/**
 * Categorias (`listCategories`, lista plana rotulada pelo `path`) usadas nos
 * filtros da listagem e no formulário de produto. Carrega uma vez por tela;
 * falha vira toaster e lista vazia. As marcas vêm de `useBrandOptions`, com
 * busca na API e carregamento por páginas.
 */
export function useProductOptions() {
  const { session } = useAuth();
  const token = session?.token;

  const [categories, setCategories] = useState<CatalogCategory[] | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    listCategories(token)
      .then((next) => {
        if (!cancelled) setCategories(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setCategories([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const categoryOptions = useMemo<ProductSelectOption[]>(
    () => (categories ?? []).map((category) => ({ label: category.path, value: category.id })),
    [categories],
  );

  return {
    categoryOptions,
    loading: categories === null,
  };
}
