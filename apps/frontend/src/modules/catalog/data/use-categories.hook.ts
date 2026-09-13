'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { buildListHref, pageParam, parsePage, type ListQueryChanges } from '@/shared/util/list-query.util';
import {
  deleteCategory,
  listCategories,
  listCategoryChildren,
  listCategoryTree,
  type CatalogCategory,
  type CatalogCategoryNode,
} from './category.api';
import { flattenCategoryTree, type CategoryTreeRow, type CategoryTreeViewState } from './category.util';

const SEARCH_DEBOUNCE_MS = 300;

/** Departamentos por página da árvore e categorias por página da busca (o padrão da API). */
export const CATEGORIES_PAGE_SIZE = 20;

/** Chave do `localStorage` com a preferência "Expandir tudo" (`"true"`/`"false"`). */
export const CATEGORIES_TREE_EXPANDED_STORAGE_KEY = 'jaja:categories:tree-expanded';

/** `tree`: árvore paginada por departamento; `search`: lista plana das categorias encontradas. */
export type CategoriesMode = 'tree' | 'search';

type CategoriesResult = {
  /** Chave da requisição que produziu os dados (modo + página + busca/preferência + recarga). */
  key: string;
  mode: CategoriesMode;
  /** A árvore veio com a subárvore completa (preferência "Expandir tudo"). */
  expanded: boolean;
  /** Raízes da página (modo árvore). */
  tree: CatalogCategoryNode[];
  /** Categorias encontradas (modo busca). */
  categories: CatalogCategory[];
  total: number;
  totalPages: number;
  failed: boolean;
};

/** Estado por nó da árvore exibida; vale só para os dados de `key`. */
type NodeState = {
  key: string;
  /** Árvore expandida: nós recolhidos localmente. */
  collapsedIds: ReadonlySet<string>;
  /** Árvore recolhida: nós abertos. */
  expandedIds: ReadonlySet<string>;
  /** Árvore recolhida: filhas diretas já buscadas, por nó (cache). */
  childrenById: ReadonlyMap<string, CatalogCategoryNode[]>;
  /** Árvore recolhida: nós com as filhas em carregamento. */
  loadingIds: ReadonlySet<string>;
};

function emptyNodeState(key: string): NodeState {
  return { key, collapsedIds: new Set(), expandedIds: new Set(), childrenById: new Map(), loadingIds: new Set() };
}

function toggled(ids: ReadonlySet<string>, id: string, include: boolean): ReadonlySet<string> {
  const next = new Set(ids);
  if (include) next.add(id);
  else next.delete(id);
  return next;
}

// Preferência lida do navegador via store externo: servidor e hidratação veem `null`
// (ainda desconhecida), e a leitura real só acontece no cliente, depois de montar.
const subscribeToNothing = () => () => {};
const getServerStoredExpanded = (): boolean | null => null;

function getStoredExpanded(): boolean | null {
  try {
    return window.localStorage.getItem(CATEGORIES_TREE_EXPANDED_STORAGE_KEY) === 'true';
  } catch {
    // Armazenamento indisponível: vale "recolhida".
    return false;
  }
}

function storeExpanded(expanded: boolean): void {
  try {
    window.localStorage.setItem(CATEGORIES_TREE_EXPANDED_STORAGE_KEY, String(expanded));
  } catch {
    // Sem persistência a escolha vale só nesta tela.
  }
}

/**
 * Lista administrativa de categorias com `page` e `search` na URL (recarregar
 * ou compartilhar a URL reproduz a lista). A busca aplica ~300 ms depois da
 * última tecla e volta para a primeira página; página além da última vai para
 * a última.
 *
 * Sem busca (`mode = 'tree'`), mostra a árvore paginada por departamento no
 * modo da preferência `expanded`, guardada em
 * `localStorage['jaja:categories:tree-expanded']` (recolhida por padrão, lida
 * depois de montar, nunca na URL): recolhida busca só as raízes e `toggleNode`
 * busca as filhas diretas na primeira abertura de cada nó (cache por nó, linha
 * "Carregando…" enquanto chegam); expandida busca a subárvore em uma chamada e
 * `toggleNode` recolhe localmente. Trocar a preferência recarrega a página
 * atual no novo modo. Com busca (`mode = 'search'`), mostra a lista plana.
 *
 * `loading` é derivado: vale `true` enquanto os dados exibidos não
 * correspondem à URL e à preferência atuais. `listQuery` é a query string
 * atual, levada aos links do formulário para o retorno à mesma página e busca.
 */
export function useCategories() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const token = session?.token;

  const listQuery = searchParams.toString();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() ?? '';
  const mode: CategoriesMode = search ? 'search' : 'tree';

  // Texto do campo de busca; acompanha a URL quando ela muda por fora (voltar/avançar).
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (searchInput.trim() !== search) setSearchInput(search);
  }

  const storedExpanded = useSyncExternalStore(subscribeToNothing, getStoredExpanded, getServerStoredExpanded);
  const [chosenExpanded, setChosenExpanded] = useState<boolean | null>(null);
  const expandedPreference = chosenExpanded ?? storedExpanded;
  const expanded = expandedPreference ?? false;
  // A árvore só é buscada depois de conhecer a preferência, para não buscar duas vezes.
  const preferenceReady = expandedPreference !== null;

  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<CategoriesResult | null>(null);

  const requestKey =
    mode === 'search'
      ? ['search', page, search, reloadCount].join('|')
      : ['tree', page, expanded ? 'expanded' : 'collapsed', reloadCount].join('|');
  const loading = result?.key !== requestKey;

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
    if (mode === 'tree' && !preferenceReady) return;

    let cancelled = false;

    const request: Promise<Omit<CategoriesResult, 'key' | 'failed'>> =
      mode === 'search'
        ? listCategories(token, { page, pageSize: CATEGORIES_PAGE_SIZE, search }).then((data) => ({
            mode,
            expanded: false,
            tree: [],
            categories: data.items,
            total: data.total,
            totalPages: data.totalPages,
          }))
        : listCategoryTree(token, { page, pageSize: CATEGORIES_PAGE_SIZE, expanded }).then((data) => ({
            mode,
            expanded,
            tree: data.items,
            categories: [],
            total: data.total,
            totalPages: data.totalPages,
          }));

    request
      .then((next) => {
        if (!cancelled) setResult({ ...next, key: requestKey, failed: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setResult((previous) =>
          previous
            ? { ...previous, key: requestKey, failed: true }
            : { key: requestKey, mode, expanded, tree: [], categories: [], total: 0, totalPages: 0, failed: true },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, mode, page, search, expanded, preferenceReady, requestKey]);

  // Página além da última (link antigo ou exclusão feita em outra aba): vai para a última existente.
  const lastPage = Math.max(1, result?.totalPages ?? 0);
  const pageOutOfRange = !loading && result?.failed === false && page > lastPage;

  useEffect(() => {
    if (pageOutOfRange) replaceQuery({ page: pageParam(lastPage) });
  }, [pageOutOfRange, lastPage, replaceQuery]);

  // Estado por nó dos dados exibidos; outra página, modo ou recarga começa do zero.
  const resultKey = result?.key ?? '';
  const [nodeStateValue, setNodeState] = useState<NodeState>(() => emptyNodeState(''));
  const nodeState = nodeStateValue.key === resultKey ? nodeStateValue : emptyNodeState(resultKey);
  const treeExpanded = result?.expanded ?? false;

  const rows = useMemo<CategoryTreeRow[]>(() => {
    if (!result || result.mode !== 'tree') return [];

    const view: CategoryTreeViewState = treeExpanded
      ? { collapsedIds: nodeState.collapsedIds }
      : { expandedIds: nodeState.expandedIds, childrenById: nodeState.childrenById, loadingIds: nodeState.loadingIds };

    return flattenCategoryTree(result.tree, view);
  }, [result, treeExpanded, nodeState]);

  /**
   * Abre ou fecha um nó. Na árvore expandida, só alterna localmente. Na
   * recolhida, a primeira abertura busca as filhas diretas (linha
   * "Carregando…" enquanto chegam); fechar e abrir de novo usa o cache. Falha
   * vira toaster e fecha o nó, para permitir tentar de novo.
   */
  const toggleNode = useCallback(
    (node: CatalogCategory) => {
      const update = (change: (state: NodeState) => NodeState) =>
        setNodeState((previous) => change(previous.key === resultKey ? previous : emptyNodeState(resultKey)));

      if (treeExpanded) {
        update((state) => ({
          ...state,
          collapsedIds: toggled(state.collapsedIds, node.id, !state.collapsedIds.has(node.id)),
        }));
        return;
      }

      const opening = !nodeState.expandedIds.has(node.id);
      const fetchChildren =
        opening && token !== undefined && !nodeState.childrenById.has(node.id) && !nodeState.loadingIds.has(node.id);

      update((state) => ({
        ...state,
        expandedIds: toggled(state.expandedIds, node.id, opening),
        loadingIds: fetchChildren ? toggled(state.loadingIds, node.id, true) : state.loadingIds,
      }));

      if (!fetchChildren || !token) return;

      // Aplica a resposta só se os dados exibidos ainda forem os mesmos.
      const settle = (change: (state: NodeState) => NodeState) =>
        setNodeState((previous) => (previous.key === resultKey ? change(previous) : previous));

      listCategoryChildren(token, node.id)
        .then((children) =>
          settle((state) => {
            const childrenById = new Map(state.childrenById);
            childrenById.set(node.id, children);
            return { ...state, childrenById, loadingIds: toggled(state.loadingIds, node.id, false) };
          }),
        )
        .catch((error: unknown) => {
          toast.error(toErrorMessage(error));
          settle((state) => ({
            ...state,
            expandedIds: toggled(state.expandedIds, node.id, false),
            loadingIds: toggled(state.loadingIds, node.id, false),
          }));
        });
    },
    [token, resultKey, treeExpanded, nodeState],
  );

  /** Troca a preferência, grava no navegador e recarrega a página atual no novo modo. */
  const setExpanded = useCallback((next: boolean) => {
    storeExpanded(next);
    setChosenExpanded(next);
  }, []);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const pageItemIds = useMemo(() => {
    if (!result) return [];
    return result.mode === 'tree' ? result.tree.map((node) => node.id) : result.categories.map((item) => item.id);
  }, [result]);

  /**
   * Exclui a categoria, avisa com toaster e busca de novo a página atual,
   * limpando o cache de filhas; se ela era o único item (departamento, na
   * árvore) de uma página que não é a primeira, vai para a anterior. Erro
   * (inclusive `409 CATEGORY_HAS_CHILDREN` e `409 CATEGORY_HAS_PRODUCTS`) vira
   * toaster com a mensagem traduzida da API: a categoria continua na lista.
   */
  const remove = useCallback(
    async (id: string) => {
      if (!token) return;

      try {
        await deleteCategory(token, id);
        toast.success('Categoria excluída');

        if (page > 1 && pageItemIds.length === 1 && pageItemIds[0] === id) {
          replaceQuery({ page: pageParam(page - 1) });
        } else {
          reload();
        }
      } catch (error) {
        toast.error(toErrorMessage(error));
      }
    },
    [token, page, pageItemIds, replaceQuery, reload],
  );

  return {
    /** Modo pedido pela URL atual. */
    mode,
    /** Modo dos dados exibidos (pode diferir de `mode` enquanto a troca carrega). */
    shownMode: result?.mode ?? mode,
    /** Linhas visíveis da árvore (modo árvore). */
    rows,
    /** Categorias encontradas (modo busca). */
    categories: result?.categories ?? [],
    total: result?.total ?? 0,
    totalPages: result?.totalPages ?? 0,
    page,
    loading,
    firstLoad: result === null,
    search,
    searchInput,
    setSearchInput,
    listQuery,
    setPage,
    expanded,
    setExpanded,
    toggleNode,
    reload,
    remove,
  };
}
