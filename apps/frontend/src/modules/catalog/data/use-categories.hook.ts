'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { deleteCategory, listCategories, type CatalogCategory } from './category.api';
import { buildCategoryTree } from './category.util';

const NO_CATEGORIES: CatalogCategory[] = [];

type CategoriesResult = {
  /** Chave da requisição que produziu `categories` (recarga). */
  key: string;
  categories: CatalogCategory[];
};

/**
 * Categorias da área administrativa: a lista plana da API e a árvore derivada
 * (memoizada, recalculada só quando a lista muda). Busca ao montar e a cada
 * `reload`. `isLoading` é derivado: vale `true` enquanto a lista exibida não
 * corresponde à última recarga, sem `setState` síncrono em efeito.
 */
export function useCategories() {
  const { session } = useAuth();
  const token = session?.token;

  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<CategoriesResult | null>(null);

  const requestKey = String(reloadCount);
  const isLoading = result?.key !== requestKey;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    listCategories(token)
      .then((categories) => {
        if (!cancelled) setResult({ key: requestKey, categories });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setResult((previous) => ({ key: requestKey, categories: previous?.categories ?? NO_CATEGORIES }));
      });

    return () => {
      cancelled = true;
    };
  }, [token, requestKey]);

  const categories = result?.categories ?? NO_CATEGORIES;
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  /**
   * Exclui a categoria, avisa com toaster e recarrega a árvore. Erro (inclusive
   * `409 CATEGORY_HAS_PRODUCTS`, "Categoria possui produtos cadastrados", e
   * `409 CATEGORY_HAS_CHILDREN`, se outra pessoa criou uma filha no meio tempo)
   * vira toaster com a mensagem traduzida da API, sem toast de sucesso: a
   * categoria continua na árvore.
   */
  const remove = useCallback(
    async (id: string) => {
      if (!token) return;

      try {
        await deleteCategory(token, id);
        toast.success('Categoria excluída');
        reload();
      } catch (error) {
        toast.error(toErrorMessage(error));
      }
    },
    [token, reload],
  );

  return {
    categories,
    tree,
    isLoading,
    reload,
    remove,
  };
}
