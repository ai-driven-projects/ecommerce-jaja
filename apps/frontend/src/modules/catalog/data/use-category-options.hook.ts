'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getCategory, listCategories, type CatalogCategory, type CategoryLevel } from './category.api';

const SEARCH_DEBOUNCE_MS = 300;

/** Categorias carregadas por vez no seletor; "Carregar mais" busca a próxima página. */
export const CATEGORY_OPTIONS_PAGE_SIZE = 20;

/** Rótulo da categoria selecionada que não pôde ser buscada. */
export const UNAVAILABLE_CATEGORY_LABEL = 'Categoria indisponível';

/** Opção de `Combobox` de categoria, rotulada pelo caminho completo. */
export type CategoryOption = {
  label: string;
  value: string;
};

/** Estado de um seletor de categoria com busca na API e carregamento por páginas. */
export type CategorySelectState = {
  /** Categorias carregadas para a busca atual, na ordem da API. */
  options: CategoryOption[];
  /** Texto digitado no seletor (sem debounce). */
  search: string;
  setSearch: (search: string) => void;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Opção do valor selecionado, mesmo quando ela não está entre as carregadas. */
  selectedOption: CategoryOption | null;
};

export type UseCategoryOptionsParams = {
  /** Só categorias até este nível (ex.: `2` para o seletor de pai). */
  maxLevel?: CategoryLevel;
  /** Sem esta categoria e suas descendentes (seletor de pai na edição). */
  excludeSubtreeOf?: string;
  /** Categoria selecionada; se não estiver carregada e sem `selectedLabel`, é buscada por id. */
  selectedId?: string;
  /** Rótulo já conhecido da categoria selecionada (ex.: `categoryPath` do produto). */
  selectedLabel?: string;
};

type LoadedPages = {
  /** Busca e filtros que produziram as páginas. */
  key: string;
  /** Páginas carregadas para `key`, indexadas a partir de 0. */
  pages: CatalogCategory[][];
  totalPages: number;
};

function toOption(category: CatalogCategory): CategoryOption {
  return { label: category.path, value: category.id };
}

/**
 * Opções de categoria para seletores: busca na API (~300 ms depois da última
 * tecla, voltando à primeira página), ordenadas pelo caminho, e acumula as
 * páginas pedidas por `loadMore`. `maxLevel` e `excludeSubtreeOf` são filtrados
 * na API. `loading` é derivado: vale `true` enquanto a busca digitada não foi
 * aplicada ou a página pedida não chegou. Uma categoria selecionada fora das
 * páginas carregadas ganha rótulo por `selectedLabel` ou por
 * `GET /categories/:id` (falha → "Categoria indisponível").
 */
export function useCategoryOptions({
  maxLevel,
  excludeSubtreeOf,
  selectedId,
  selectedLabel,
}: UseCategoryOptionsParams = {}): CategorySelectState {
  const { session } = useAuth();
  const token = session?.token;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [requested, setRequested] = useState({ key: '', page: 1 });
  const [loaded, setLoaded] = useState<LoadedPages | null>(null);
  const [resolved, setResolved] = useState<CategoryOption | null>(null);

  const queryKey = [appliedSearch, maxLevel ?? '', excludeSubtreeOf ?? ''].join('|');

  // Página pedida para a busca e os filtros aplicados; outra combinação começa na primeira.
  const page = requested.key === queryKey ? requested.page : 1;

  useEffect(() => {
    const next = search.trim();
    const timer = setTimeout(() => setAppliedSearch(next), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const store = (items: CatalogCategory[], totalPages: number) =>
      setLoaded((previous) => {
        const pages = previous?.key === queryKey ? previous.pages.slice(0, page - 1) : [];
        pages[page - 1] = items;
        return { key: queryKey, pages, totalPages };
      });

    listCategories(token, {
      page,
      pageSize: CATEGORY_OPTIONS_PAGE_SIZE,
      search: appliedSearch,
      maxLevel,
      excludeSubtreeOf,
    })
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
  }, [token, queryKey, appliedSearch, maxLevel, excludeSubtreeOf, page]);

  const current = loaded?.key === queryKey ? loaded : null;
  const pageLoaded = current?.pages[page - 1] !== undefined;
  const loading = search.trim() !== appliedSearch || !pageLoaded;
  const hasMore = Boolean(current && pageLoaded && page < current.totalPages);

  const options = useMemo(() => {
    const seen = new Set<string>();
    return (current?.pages ?? [])
      .flat()
      .filter((category) => {
        if (seen.has(category.id)) return false;
        seen.add(category.id);
        return true;
      })
      .map(toOption);
  }, [current]);

  const loadMore = useCallback(() => {
    if (hasMore) setRequested({ key: queryKey, page: page + 1 });
  }, [hasMore, queryKey, page]);

  const foundOption = selectedId ? options.find((option) => option.value === selectedId) : undefined;
  const needsLookup = Boolean(selectedId && !foundOption && !selectedLabel);

  useEffect(() => {
    if (!token || !selectedId || !needsLookup || resolved?.value === selectedId) return;

    let cancelled = false;

    getCategory(token, selectedId)
      .then((category) => {
        if (!cancelled) setResolved(toOption(category));
      })
      .catch(() => {
        if (!cancelled) setResolved({ value: selectedId, label: UNAVAILABLE_CATEGORY_LABEL });
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedId, needsLookup, resolved]);

  let selectedOption: CategoryOption | null = null;
  if (selectedId) {
    if (foundOption) selectedOption = foundOption;
    else if (selectedLabel) selectedOption = { value: selectedId, label: selectedLabel };
    else if (resolved?.value === selectedId) selectedOption = resolved;
  }

  return { options, search, setSearch, loading, hasMore, loadMore, selectedOption };
}
