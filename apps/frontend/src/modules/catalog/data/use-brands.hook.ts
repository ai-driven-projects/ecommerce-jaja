'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { buildListHref, pageParam, parsePage, type ListQueryChanges } from '@/shared/util/list-query.util';
import { deleteBrand, listBrands, type BrandPage } from './brand.api';

const SEARCH_DEBOUNCE_MS = 300;

/** Marcas por página da lista (o mesmo padrão da API). */
export const BRANDS_PAGE_SIZE = 20;

const EMPTY_PAGE: BrandPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: BRANDS_PAGE_SIZE,
  totalPages: 0,
};

type BrandsResult = {
  /** Chave da requisição que produziu `data` (página + busca + recarga). */
  key: string;
  data: BrandPage;
  failed: boolean;
};

/**
 * Lista administrativa de marcas com o estado na URL: `page` e `search` vêm de
 * `useSearchParams` (recarregar ou compartilhar a URL reproduz a lista). A busca
 * (texto livre sobre nome, slug e descrição) aplica ~300 ms depois da última
 * tecla e volta para a primeira página. `loading` é derivado: vale `true`
 * enquanto a página exibida não corresponde à URL atual. `listQuery` é a query
 * string atual, levada aos links do formulário para o retorno à mesma página.
 */
export function useBrands() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const token = session?.token;

  const listQuery = searchParams.toString();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() ?? '';

  // Texto do campo de busca; acompanha a URL quando ela muda por fora (voltar/avançar).
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }

  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<BrandsResult | null>(null);

  const requestKey = [page, search, reloadCount].join('|');
  const loading = result?.key !== requestKey;
  const data = result?.data ?? EMPTY_PAGE;

  const replaceQuery = useCallback(
    (changes: ListQueryChanges) => router.replace(buildListHref(pathname, listQuery, changes), { scroll: false }),
    [router, pathname, listQuery],
  );

  const setPage = useCallback(
    (next: number) => router.push(buildListHref(pathname, listQuery, { page: pageParam(next) })),
    [router, pathname, listQuery],
  );

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;

    const timer = setTimeout(() => replaceQuery({ search: next, page: undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, replaceQuery]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    listBrands(token, { page, pageSize: BRANDS_PAGE_SIZE, search })
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
  }, [token, page, search, requestKey]);

  // Página além da última (link antigo ou exclusão feita em outra aba): vai para a última existente.
  const lastPage = Math.max(1, data.totalPages);
  const pageOutOfRange = !loading && result?.failed === false && page > lastPage;

  useEffect(() => {
    if (pageOutOfRange) replaceQuery({ page: pageParam(lastPage) });
  }, [pageOutOfRange, lastPage, replaceQuery]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const itemCount = data.items.length;

  /**
   * Exclui a marca, avisa com toaster e busca de novo na mesma página; se ela
   * era a única de uma página que não é a primeira, vai para a anterior. Erro
   * (inclusive `409 BRAND_HAS_PRODUCTS`, "Marca possui produtos cadastrados")
   * vira toaster com a mensagem traduzida da API, sem toast de sucesso nem
   * recarga: a marca continua na lista.
   */
  const remove = useCallback(
    async (id: string) => {
      if (!token) return;

      try {
        await deleteBrand(token, id);
        toast.success('Marca excluída');

        if (itemCount === 1 && page > 1) replaceQuery({ page: pageParam(page - 1) });
        else reload();
      } catch (error) {
        toast.error(toErrorMessage(error));
      }
    },
    [token, itemCount, page, replaceQuery, reload],
  );

  return {
    brands: data.items,
    total: data.total,
    totalPages: data.totalPages,
    page,
    loading,
    firstLoad: result === null,
    search,
    searchInput,
    setSearchInput,
    listQuery,
    setPage,
    reload,
    remove,
  };
}
