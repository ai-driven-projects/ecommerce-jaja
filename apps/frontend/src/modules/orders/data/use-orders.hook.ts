'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { buildListHref, pageParam, parsePage, type ListQueryChanges } from '@/shared/util/list-query.util';
import { listOrders, type OrderPage, type OrderStatusFilter } from './admin-order.api';
import type { OrderStatus } from './order.api';
import { ORDER_STATUS_LABEL } from './order-status.util';
import { useLiveRefetch, type LiveLoad } from './use-live-refetch.hook';

const SEARCH_DEBOUNCE_MS = 300;

/** Pedidos por página da lista (o mesmo padrão da API). */
export const ORDERS_PAGE_SIZE = 20;

/** Toaster único da lista: falhas seguidas não empilham avisos. */
const ORDERS_ERROR_TOAST_ID = 'orders-list-error';

const EMPTY_PAGE: OrderPage = { items: [], total: 0, page: 1, pageSize: ORDERS_PAGE_SIZE, totalPages: 0 };

const EMPTY_IDS: ReadonlySet<string> = new Set();

/** `status` da URL: só os status do pedido e `IN_PROGRESS` filtram; o resto vale "todos". */
export function parseOrderStatusFilter(value: string | null): OrderStatusFilter | undefined {
  if (value === 'IN_PROGRESS') return value;
  if (value !== null && Object.hasOwn(ORDER_STATUS_LABEL, value)) return value as OrderStatus;
  return undefined;
}

type OrdersResult = {
  /** Chave da leitura que produziu `data` (sessão + página + status + busca). */
  key: string;
  data: OrderPage;
  failed: boolean;
  /** Status de cada pedido na primeira vez em que apareceu nesta chave. */
  firstStatusById: Readonly<Record<string, OrderStatus>>;
  /** Pedidos que apareceram depois da primeira leitura desta chave (linhas novas). */
  newIds: ReadonlySet<string>;
};

/**
 * Próximo resultado de uma chave: na primeira leitura, os pedidos exibidos são a
 * base (nenhum é novo); nas releituras, os que não estavam na base entram em
 * `newIds` e passam a fazer parte dela, com o status em que apareceram.
 */
function nextResult(previous: OrdersResult | null, key: string, data: OrderPage): OrdersResult {
  const sameKey = previous?.key === key;
  const firstStatusById: Record<string, OrderStatus> = sameKey ? { ...previous.firstStatusById } : {};
  const newIds = new Set(sameKey ? previous.newIds : []);

  for (const item of data.items) {
    if (firstStatusById[item.id] !== undefined) continue;
    firstStatusById[item.id] = item.status;
    if (sameKey && !previous.failed) newIds.add(item.id);
  }

  return { key, data, failed: false, firstStatusById, newIds };
}

/**
 * Lista administrativa de pedidos, ao vivo, com o estado na URL: `page`,
 * `status` (um status ou `IN_PROGRESS`) e `search` vêm de `useSearchParams`
 * (recarregar ou compartilhar a URL reproduz a lista), no padrão de `useCustomers`.
 *
 * - A busca (número do pedido ou nome do cliente) aplica ~300 ms depois da
 *   última tecla e, como a troca de status, volta para a primeira página.
 * - A página é relida pela API a cada aviso do stream administrativo e a cada
 *   reconexão (`useLiveRefetch`), sem recarregar e sem voltar a `loading`.
 * - `loading` vale `true` enquanto a página exibida não corresponde à URL atual.
 * - `newIds`: pedidos que apareceram depois da primeira carga desta URL (para o
 *   destaque das linhas novas); `statusChanged(id, status)`: o status mudou desde
 *   que o pedido apareceu (para o destaque da célula de status).
 * - Erro na leitura vira **um** toaster e mantém a página exibida.
 * - `listQuery` é a query string atual, levada ao painel do pedido para o retorno.
 */
export function useOrders() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const token = session?.token;

  const listQuery = searchParams.toString();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() ?? '';
  const status = parseOrderStatusFilter(searchParams.get('status'));

  // Texto do campo de busca; acompanha a URL quando ela muda por fora (voltar/avançar, "Limpar filtros").
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }

  const [result, setResult] = useState<OrdersResult | null>(null);

  const requestKey = [token ?? '', page, status ?? '', search].join('|');
  const current = result?.key === requestKey ? result : null;
  const loading = current === null;
  const data = result?.data ?? EMPTY_PAGE;

  const load = useCallback<LiveLoad>(
    async (isCurrent) => {
      if (!token) return;
      try {
        const next = await listOrders(token, { page, pageSize: ORDERS_PAGE_SIZE, status, search });
        if (!isCurrent()) return;
        setResult((previous) => nextResult(previous, requestKey, next));
      } catch (error: unknown) {
        if (!isCurrent()) return;
        toast.error(toErrorMessage(error), { id: ORDERS_ERROR_TOAST_ID });
        setResult((previous) =>
          previous?.key === requestKey
            ? previous
            : { key: requestKey, data: previous?.data ?? EMPTY_PAGE, failed: true, firstStatusById: {}, newIds: new Set() },
        );
      }
    },
    [token, page, status, search, requestKey],
  );

  useLiveRefetch(token ? load : null);

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
    (next: OrderStatusFilter | undefined) => replaceQuery({ status: next, page: undefined }),
    [replaceQuery],
  );

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;

    const timer = setTimeout(() => replaceQuery({ search: next, page: undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, replaceQuery]);

  // Página além da última (link antigo ou filtro que reduziu a lista): vai para a última existente.
  const lastPage = Math.max(1, data.totalPages);
  const pageOutOfRange = !loading && current?.failed === false && page > lastPage;

  useEffect(() => {
    if (pageOutOfRange) replaceQuery({ page: pageParam(lastPage) });
  }, [pageOutOfRange, lastPage, replaceQuery]);

  const firstStatusById = current?.firstStatusById;
  const statusChanged = useCallback(
    (id: string, next: OrderStatus) => {
      const first = firstStatusById?.[id];
      return first !== undefined && first !== next;
    },
    [firstStatusById],
  );

  return {
    orders: data.items,
    total: data.total,
    totalPages: data.totalPages,
    page,
    loading,
    firstLoad: result === null,
    search,
    searchInput,
    setSearchInput,
    status,
    filtered: search !== '' || status !== undefined,
    listQuery,
    newIds: current?.newIds ?? EMPTY_IDS,
    statusChanged,
    setPage,
    setStatus,
  };
}
