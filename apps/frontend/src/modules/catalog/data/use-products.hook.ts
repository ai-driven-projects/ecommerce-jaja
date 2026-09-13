'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { buildListHref, pageParam, parsePage, type ListQueryChanges } from '@/shared/util/list-query.util';
import { deleteProduct, listProducts, type CatalogProductPage } from './product.api';
import { useBrandOptions } from './use-brand-options.hook';
import { useCategoryOptions } from './use-category-options.hook';

const SEARCH_DEBOUNCE_MS = 300;

/** Itens por página da listagem (o mesmo padrão da API). */
export const PRODUCTS_PAGE_SIZE = 20;

const EMPTY_PAGE: CatalogProductPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: PRODUCTS_PAGE_SIZE,
  totalPages: 0,
};

/** Filtros da listagem guardados na URL; `undefined` ou vazio remove o parâmetro. */
export type ProductListFilterChanges = {
  search?: string;
  brandId?: string;
  categoryId?: string;
  isActive?: boolean;
};

type ProductsResult = {
  /** Chave da requisição que produziu `data` (página + filtros + recarga). */
  key: string;
  data: CatalogProductPage;
  failed: boolean;
};

function parseIsActive(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Listagem administrativa de produtos com o estado na URL: `page`, `search`,
 * `brandId`, `categoryId` e `isActive` vêm de `useSearchParams` (recarregar ou
 * compartilhar a URL reproduz a lista). Mudar um filtro faz `router.replace`
 * sem `page`; a busca aplica ~300 ms depois da última tecla. Monta também os
 * seletores dos filtros, ambos com busca na API e "Carregar mais": marcas
 * (`brandSelect`) e categorias pelo caminho (`categorySelect`), com a
 * `categoryId` da URL já rotulada. `loading` é derivado: vale `true` enquanto a
 * página exibida não corresponde à URL atual. `listQuery` é a query string
 * atual, levada aos links do formulário para o retorno à mesma lista.
 */
export function useProducts() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const token = session?.token;

  const listQuery = searchParams.toString();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() ?? '';
  const brandId = searchParams.get('brandId') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const isActive = parseIsActive(searchParams.get('isActive'));

  const brandSelect = useBrandOptions({ selectedId: brandId || undefined });
  const categorySelect = useCategoryOptions({ selectedId: categoryId || undefined });

  // Texto do campo de busca; acompanha a URL quando ela muda por fora (voltar/avançar, limpar).
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }

  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<ProductsResult | null>(null);

  const requestKey = [page, search, brandId, categoryId, isActive ?? '', reloadCount].join('|');
  const loading = result?.key !== requestKey;
  const data = result?.data ?? EMPTY_PAGE;

  const replaceQuery = useCallback(
    (changes: ListQueryChanges) => router.replace(buildListHref(pathname, listQuery, changes), { scroll: false }),
    [router, pathname, listQuery],
  );

  /** Aplica filtros e volta para a primeira página. */
  const setFilter = useCallback(
    (changes: ProductListFilterChanges) => {
      const query: ListQueryChanges = { page: undefined };
      for (const [key, value] of Object.entries(changes)) {
        query[key] = value === undefined ? undefined : String(value);
      }
      replaceQuery(query);
    },
    [replaceQuery],
  );

  const setPage = useCallback(
    (next: number) => router.push(buildListHref(pathname, listQuery, { page: pageParam(next) })),
    [router, pathname, listQuery],
  );

  const clearFilters = useCallback(() => {
    setSearchInput('');
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;

    const timer = setTimeout(() => setFilter({ search: next }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, setFilter]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    listProducts(token, { page, pageSize: PRODUCTS_PAGE_SIZE, search, brandId, categoryId, isActive })
      .then((next) => {
        if (!cancelled) setResult({ key: requestKey, data: next, failed: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setResult((previous) => ({ key: requestKey, data: previous?.data ?? EMPTY_PAGE, failed: true }));
      });

    return () => {
      cancelled = true;
    };
  }, [token, page, search, brandId, categoryId, isActive, requestKey]);

  // Página além da última (link antigo ou exclusão feita em outra aba): vai para a última existente.
  const lastPage = Math.max(1, data.totalPages);
  const pageOutOfRange = !loading && result?.failed === false && page > lastPage;

  useEffect(() => {
    if (pageOutOfRange) replaceQuery({ page: pageParam(lastPage) });
  }, [pageOutOfRange, lastPage, replaceQuery]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const itemCount = data.items.length;

  /**
   * Exclui o produto, avisa com toaster e busca de novo na mesma página e
   * filtros; se ele era o único item de uma página que não é a primeira, vai
   * para a página anterior. Erro vira toaster com a mensagem da API.
   */
  const remove = useCallback(
    async (id: string) => {
      if (!token) return;

      try {
        await deleteProduct(token, id);
        toast.success('Produto excluído');

        if (itemCount === 1 && page > 1) replaceQuery({ page: pageParam(page - 1) });
        else reload();
      } catch (error) {
        toast.error(toErrorMessage(error));
      }
    },
    [token, itemCount, page, replaceQuery, reload],
  );

  return {
    products: data.items,
    total: data.total,
    totalPages: data.totalPages,
    page,
    loading,
    firstLoad: result === null,
    search,
    searchInput,
    setSearchInput,
    brandId,
    categoryId,
    isActive,
    hasFilters: search !== '' || brandId !== '' || categoryId !== '' || isActive !== undefined,
    brandSelect,
    categorySelect,
    listQuery,
    setFilter,
    setPage,
    clearFilters,
    reload,
    remove,
  };
}
