'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getStore, listStores, type Store } from './store.api';

const SEARCH_DEBOUNCE_MS = 300;

/** Lojas carregadas por vez no seletor; "Carregar mais" busca a próxima página. */
export const STORE_OPTIONS_PAGE_SIZE = 20;

/** Opção de `Combobox` de loja. */
export type StoreOption = {
  label: string;
  value: string;
};

/** Estado de um seletor de loja com busca na API e carregamento por páginas. */
export type StoreSelectState = {
  /** Lojas carregadas para a busca atual, na ordem da API. */
  options: StoreOption[];
  /** Texto digitado no seletor (sem debounce). */
  search: string;
  setSearch: (search: string) => void;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Opção do valor selecionado, mesmo quando ela não está entre as carregadas. */
  selectedOption: StoreOption | null;
};

export type UseStoreOptionsParams = {
  /** Loja selecionada; se não estiver carregada e sem `selectedLabel`, é buscada por id. */
  selectedId?: string;
  /** Rótulo já conhecido da loja selecionada (ex.: `storeName` de um pedido). */
  selectedLabel?: string;
};

type LoadedPages = {
  search: string;
  /** Páginas carregadas para `search`, indexadas a partir de 0. */
  pages: Store[][];
  totalPages: number;
};

function toOption(store: Store): StoreOption {
  return { label: store.name, value: store.id };
}

/**
 * Opções de loja para seletores (ex.: formulários e filtros de pedidos): busca
 * na API (~300 ms depois da última tecla, voltando à primeira página) e acumula
 * as páginas pedidas por `loadMore`. `loading` é derivado: vale `true` enquanto
 * a busca digitada não foi aplicada ou a página pedida não chegou. Uma loja
 * selecionada fora das páginas carregadas ganha rótulo por `selectedLabel` ou
 * por `GET /stores/:id`.
 */
export function useStoreOptions({ selectedId, selectedLabel }: UseStoreOptionsParams = {}): StoreSelectState {
  const { session } = useAuth();
  const token = session?.token;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [requested, setRequested] = useState({ search: '', page: 1 });
  const [loaded, setLoaded] = useState<LoadedPages | null>(null);
  const [resolved, setResolved] = useState<StoreOption | null>(null);

  // Página pedida para a busca aplicada; outra busca começa na primeira.
  const page = requested.search === appliedSearch ? requested.page : 1;

  useEffect(() => {
    const next = search.trim();
    const timer = setTimeout(() => setAppliedSearch(next), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const store = (items: Store[], totalPages: number) =>
      setLoaded((previous) => {
        const pages = previous?.search === appliedSearch ? previous.pages.slice(0, page - 1) : [];
        pages[page - 1] = items;
        return { search: appliedSearch, pages, totalPages };
      });

    listStores(token, { page, pageSize: STORE_OPTIONS_PAGE_SIZE, search: appliedSearch })
      .then((result) => {
        if (!cancelled) store(result.items, result.totalPages);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        // A página falha vazia e encerra o "Carregar mais".
        store([], page);
      });

    return () => {
      cancelled = true;
    };
  }, [token, appliedSearch, page]);

  const current = loaded?.search === appliedSearch ? loaded : null;
  const pageLoaded = current?.pages[page - 1] !== undefined;
  const loading = search.trim() !== appliedSearch || !pageLoaded;
  const hasMore = Boolean(current && pageLoaded && page < current.totalPages);

  const options = useMemo(() => {
    const seen = new Set<string>();
    return (current?.pages ?? [])
      .flat()
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(toOption);
  }, [current]);

  const loadMore = useCallback(() => {
    if (hasMore) setRequested({ search: appliedSearch, page: page + 1 });
  }, [hasMore, appliedSearch, page]);

  const foundOption = selectedId ? options.find((option) => option.value === selectedId) : undefined;
  const needsLookup = Boolean(selectedId && !foundOption && !selectedLabel);

  useEffect(() => {
    if (!token || !selectedId || !needsLookup || resolved?.value === selectedId) return;

    let cancelled = false;

    getStore(token, selectedId)
      .then((item) => {
        if (!cancelled) setResolved(toOption(item));
      })
      .catch(() => {
        if (!cancelled) setResolved({ value: selectedId, label: 'Loja indisponível' });
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedId, needsLookup, resolved]);

  let selectedOption: StoreOption | null = null;
  if (selectedId) {
    if (foundOption) selectedOption = foundOption;
    else if (selectedLabel) selectedOption = { value: selectedId, label: selectedLabel };
    else if (resolved?.value === selectedId) selectedOption = resolved;
  }

  return { options, search, setSearch, loading, hasMore, loadMore, selectedOption };
}
