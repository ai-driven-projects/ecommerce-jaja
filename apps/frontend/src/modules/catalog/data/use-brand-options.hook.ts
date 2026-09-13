'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getBrand, listBrands, type Brand } from './brand.api';

const SEARCH_DEBOUNCE_MS = 300;

/** Marcas carregadas por vez no seletor; "Carregar mais" busca a próxima página. */
export const BRAND_OPTIONS_PAGE_SIZE = 20;

/** Opção de `Combobox` de marca. */
export type BrandOption = {
  label: string;
  value: string;
};

/** Estado de um seletor de marca com busca na API e carregamento por páginas. */
export type BrandSelectState = {
  /** Marcas carregadas para a busca atual, na ordem da API. */
  options: BrandOption[];
  /** Texto digitado no seletor (sem debounce). */
  search: string;
  setSearch: (search: string) => void;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Opção do valor selecionado, mesmo quando ela não está entre as carregadas. */
  selectedOption: BrandOption | null;
};

export type UseBrandOptionsParams = {
  /** Marca selecionada; se não estiver carregada e sem `selectedLabel`, é buscada por id. */
  selectedId?: string;
  /** Rótulo já conhecido da marca selecionada (ex.: `brandName` do produto). */
  selectedLabel?: string;
};

type LoadedPages = {
  search: string;
  /** Páginas carregadas para `search`, indexadas a partir de 0. */
  pages: Brand[][];
  totalPages: number;
};

function toOption(brand: Brand): BrandOption {
  return { label: brand.name, value: brand.id };
}

/**
 * Opções de marca para seletores: busca na API (~300 ms depois da última tecla,
 * voltando à primeira página) e acumula as páginas pedidas por `loadMore`.
 * `loading` é derivado: vale `true` enquanto a busca digitada não foi aplicada
 * ou a página pedida não chegou. Uma marca selecionada fora das páginas
 * carregadas ganha rótulo por `selectedLabel` ou por `GET /brands/:id`.
 */
export function useBrandOptions({ selectedId, selectedLabel }: UseBrandOptionsParams = {}): BrandSelectState {
  const { session } = useAuth();
  const token = session?.token;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [requested, setRequested] = useState({ search: '', page: 1 });
  const [loaded, setLoaded] = useState<LoadedPages | null>(null);
  const [resolved, setResolved] = useState<BrandOption | null>(null);

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

    const store = (items: Brand[], totalPages: number) =>
      setLoaded((previous) => {
        const pages = previous?.search === appliedSearch ? previous.pages.slice(0, page - 1) : [];
        pages[page - 1] = items;
        return { search: appliedSearch, pages, totalPages };
      });

    listBrands(token, { page, pageSize: BRAND_OPTIONS_PAGE_SIZE, search: appliedSearch })
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
      .filter((brand) => {
        if (seen.has(brand.id)) return false;
        seen.add(brand.id);
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

    getBrand(token, selectedId)
      .then((brand) => {
        if (!cancelled) setResolved(toOption(brand));
      })
      .catch(() => {
        if (!cancelled) setResolved({ value: selectedId, label: 'Marca indisponível' });
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedId, needsLookup, resolved]);

  let selectedOption: BrandOption | null = null;
  if (selectedId) {
    if (foundOption) selectedOption = foundOption;
    else if (selectedLabel) selectedOption = { value: selectedId, label: selectedLabel };
    else if (resolved?.value === selectedId) selectedOption = resolved;
  }

  return { options, search, setSearch, loading, hasMore, loadMore, selectedOption };
}
