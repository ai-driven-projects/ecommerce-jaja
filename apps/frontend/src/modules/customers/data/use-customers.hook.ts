'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { buildListHref, pageParam, parsePage, type ListQueryChanges } from '@/shared/util/list-query.util';
import { listCustomers, type CustomerPage } from './customer.api';

const SEARCH_DEBOUNCE_MS = 300;

/** Clientes por página da lista (o mesmo padrão da API). */
export const CUSTOMERS_PAGE_SIZE = 20;

const EMPTY_PAGE: CustomerPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: CUSTOMERS_PAGE_SIZE,
  totalPages: 0,
};

type CustomersResult = {
  /** Chave da requisição que produziu `data` (página + busca + status + recarga). */
  key: string;
  data: CustomerPage;
  failed: boolean;
};

/** `isActive` da URL: só `"true"`/`"false"` filtram; o resto vale "todos". */
function parseIsActive(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Lista administrativa de clientes com o estado na URL: `page`, `search` e
 * `isActive` vêm de `useSearchParams` (recarregar ou compartilhar a URL
 * reproduz a lista). A busca (nome, email, CPF, telefone ou bairro) aplica
 * ~300 ms depois da última tecla e, como a troca de status, volta para a
 * primeira página. `loading` é derivado: vale `true` enquanto a página exibida
 * não corresponde à URL atual. `listQuery` é a query string atual, levada ao
 * link de edição para o retorno à mesma lista. Sem exclusão: clientes não são
 * excluídos pela administração.
 */
export function useCustomers() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const token = session?.token;

  const listQuery = searchParams.toString();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() ?? '';
  const isActive = parseIsActive(searchParams.get('isActive'));

  // Texto do campo de busca; acompanha a URL quando ela muda por fora (voltar/avançar).
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }

  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<CustomersResult | null>(null);

  const requestKey = [page, search, isActive ?? '', reloadCount].join('|');
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

  /** Filtra por status (`undefined` = todos) e volta para a primeira página. */
  const setStatus = useCallback(
    (next: boolean | undefined) =>
      replaceQuery({ isActive: next === undefined ? undefined : String(next), page: undefined }),
    [replaceQuery],
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

    listCustomers(token, { page, pageSize: CUSTOMERS_PAGE_SIZE, search, isActive })
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
  }, [token, page, search, isActive, requestKey]);

  // Página além da última (link antigo ou filtro que reduziu a lista): vai para a última existente.
  const lastPage = Math.max(1, data.totalPages);
  const pageOutOfRange = !loading && result?.failed === false && page > lastPage;

  useEffect(() => {
    if (pageOutOfRange) replaceQuery({ page: pageParam(lastPage) });
  }, [pageOutOfRange, lastPage, replaceQuery]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return {
    customers: data.items,
    total: data.total,
    totalPages: data.totalPages,
    page,
    loading,
    firstLoad: result === null,
    search,
    searchInput,
    setSearchInput,
    isActive,
    filtered: search !== '' || isActive !== undefined,
    listQuery,
    setPage,
    setStatus,
    reload,
  };
}
