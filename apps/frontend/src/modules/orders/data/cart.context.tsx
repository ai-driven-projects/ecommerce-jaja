'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { getMessage } from '@/shared/i18n';
import { toErrorMessage } from '@/shared/util/api-client.util';
import {
  addMyCartItem,
  clearMyCart,
  getMyCart,
  mergeMyCart,
  previewCart,
  removeMyCartItem,
  setMyCartItemQuantity,
  type CartDetail,
  type CartLine,
} from './cart.api';
import {
  CART_ITEM_MAX_QUANTITY,
  addGuestItem,
  emptyCartDetail,
  removeGuestItem,
  setGuestItemQuantity,
  type GuestCartResult,
} from './cart.util';
import {
  clearGuestItems,
  commitGuestItems,
  getGuestItemsServerSnapshot,
  getGuestItemsSnapshot,
  guestItemsKey,
  subscribe,
} from './guest-cart-storage.util';

/** Espera depois da última mudança do carrinho do visitante antes de pedir a prévia. */
const PREVIEW_DELAY_MS = 250;

/** Última prévia do visitante que deu certo: a chave dos itens e o detalhe calculado pela API. */
type GuestPreviewState = { key: string; nonce: number; detail: CartDetail };
/** Última tentativa de prévia concluída (com sucesso ou erro). */
type GuestSettledState = { key: string; nonce: number };

/**
 * Carrinho da conta, chaveado pelo token da sessão: outra sessão invalida o
 * estado. `detail` é a última resposta da API (`null` até a primeira carga),
 * `pending` conta os comandos na fila e `quantities` guarda as quantidades
 * otimistas (0 = removido) até a fila esvaziar.
 */
type AccountState = {
  token: string;
  detail: CartDetail | null;
  pending: number;
  quantities: Readonly<Record<string, number>>;
};

export type CartContextValue = {
  /** Totais e linhas como vieram da API (carrinho vazio sem dados). */
  detail: CartDetail;
  /** Linhas exibidas, com as quantidades já atualizadas na hora. */
  lines: CartLine[];
  /** Soma das quantidades, atualizada na hora. */
  count: number;
  /** Primeira carga do carrinho (inclusive a mescla ao entrar). */
  loading: boolean;
  /** Há comando ou prévia pendente: os valores ainda não foram confirmados pela API. */
  isSyncing: boolean;
  hasUnavailableItems: boolean;
  getQuantity: (productId: string) => number;
  /** Soma `quantity` ao produto; `false` quando a inclusão falhou (a mensagem já foi exibida). */
  add: (productId: string, quantity: number) => Promise<boolean>;
  /** Define a quantidade do produto; 0 remove. */
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  /** Esvazia o carrinho; `false` quando falhou (a mensagem já foi exibida). */
  clear: () => Promise<boolean>;
  /** Recarrega o carrinho exibido. */
  refresh: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function accountBase(prev: AccountState | null, token: string): AccountState {
  return prev?.token === token ? prev : { token, detail: null, pending: 0, quantities: {} };
}

function withDetail(prev: AccountState | null, token: string, detail: CartDetail): AccountState {
  return { ...accountBase(prev, token), detail };
}

/** Quantidade exibida de um produto no carrinho da conta: a otimista, senão a da API. */
function accountQuantity(state: AccountState | null, productId: string): number {
  if (!state) return 0;
  return state.quantities[productId] ?? state.detail?.lines.find((line) => line.productId === productId)?.quantity ?? 0;
}

/** Aplica as quantidades (0 ou ausente remove) às linhas da API, na ordem delas. */
function applyQuantities(lines: readonly CartLine[], quantityOf: (productId: string) => number | undefined): CartLine[] {
  return lines.flatMap((line) => {
    const quantity = quantityOf(line.productId);
    if (quantity === undefined) return [line];
    if (quantity <= 0) return [];
    return quantity === line.quantity ? [line] : [{ ...line, quantity }];
  });
}

/**
 * Carrinho da loja, com o estado aberto/fechado da gaveta. Dois modos, pela sessão:
 * - **visitante:** itens no navegador (`guest-cart-storage.util.ts`), com as
 *   linhas e os totais da prévia da API, pedida ~250 ms depois da última
 *   mudança; ids que não voltam na prévia (produto inexistente) saem do
 *   navegador; as regras de limite de `cart.util.ts` impedem a mudança;
 * - **conta:** carrinho do servidor, chaveado pelo token. Ao surgir um token,
 *   os itens do visitante são mesclados (e só apagados do navegador depois do
 *   sucesso) ou o carrinho é lido. Os comandos rodam em fila, um de cada vez,
 *   com a quantidade atualizada na hora; o estado final é a última resposta, e
 *   um erro vira toaster seguido de `refresh()`. `open` recarrega o carrinho.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.token ?? null;
  const [isOpen, setIsOpen] = useState(false);

  // ── Visitante ──────────────────────────────────────────────────────────────
  const guestItems = useSyncExternalStore(subscribe, getGuestItemsSnapshot, getGuestItemsServerSnapshot);
  const guestKey = guestItemsKey(guestItems);
  const [guestNonce, setGuestNonce] = useState(0);
  const [guestPreview, setGuestPreview] = useState<GuestPreviewState | null>(null);
  const [guestSettled, setGuestSettled] = useState<GuestSettledState | null>(null);

  useEffect(() => {
    if (token || guestItems.length === 0) return;
    if (guestSettled?.key === guestKey && guestSettled.nonce === guestNonce) return;

    let cancelled = false;
    const requested = guestItems;

    const timer = window.setTimeout(() => {
      previewCart([...requested]).then(
        (detail) => {
          if (cancelled) return;
          // Produto inexistente não volta como linha: sai do carrinho do visitante.
          const returned = new Set(detail.lines.map((line) => line.productId));
          const kept = requested.filter((item) => returned.has(item.productId));
          const key = guestItemsKey(kept);
          setGuestPreview({ key, nonce: guestNonce, detail });
          setGuestSettled({ key, nonce: guestNonce });
          if (kept.length !== requested.length) commitGuestItems(kept);
        },
        (error: unknown) => {
          if (cancelled) return;
          toast.error(toErrorMessage(error));
          setGuestSettled({ key: guestKey, nonce: guestNonce });
        },
      );
    }, PREVIEW_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, guestItems, guestKey, guestNonce, guestSettled]);

  // ── Conta ──────────────────────────────────────────────────────────────────
  const [account, setAccount] = useState<AccountState | null>(null);
  const currentAccount = token && account?.token === token ? account : null;
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Carga inicial por token: reaproveitada se o efeito rodar de novo com o mesmo
  // token (Strict Mode), para a mescla nunca ser enviada duas vezes.
  const initialLoadRef = useRef<{ token: string; promise: Promise<CartDetail> } | null>(null);

  /** Enfileira uma chamada à API: cada uma só começa depois de a anterior terminar. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  useEffect(() => {
    if (!token) {
      initialLoadRef.current = null;
      return;
    }

    let cancelled = false;
    let load = initialLoadRef.current?.token === token ? initialLoadRef.current.promise : null;

    if (!load) {
      const items = getGuestItemsSnapshot();
      load = enqueue(() =>
        items.length === 0
          ? getMyCart(token)
          : mergeMyCart(token, [...items]).then(
              (detail) => {
                clearGuestItems();
                return detail;
              },
              // Os itens do visitante ficam no navegador para uma nova tentativa.
              (error: unknown) => {
                toast.error(toErrorMessage(error));
                return getMyCart(token);
              },
            ),
      );
      initialLoadRef.current = { token, promise: load };
    }

    load.then(
      (detail) => {
        if (!cancelled) setAccount((prev) => withDetail(prev, token, detail));
      },
      (error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setAccount((prev) => withDetail(prev, token, emptyCartDetail()));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [token, enqueue]);

  const refreshAccount = useCallback(
    (sessionToken: string) =>
      enqueue(() => getMyCart(sessionToken)).then(
        (detail) => setAccount((prev) => withDetail(prev, sessionToken, detail)),
        (error: unknown) => {
          toast.error(toErrorMessage(error));
        },
      ),
    [enqueue],
  );

  /**
   * Roda um comando da conta na fila. `optimistic` calcula, a partir do estado
   * atual, as quantidades exibidas até a fila esvaziar.
   */
  const runAccountCommand = useCallback(
    async (
      sessionToken: string,
      optimistic: (state: AccountState) => Record<string, number>,
      call: () => Promise<CartDetail>,
    ): Promise<boolean> => {
      setAccount((prev) => {
        const base = accountBase(prev, sessionToken);
        return { ...base, pending: base.pending + 1, quantities: { ...base.quantities, ...optimistic(base) } };
      });

      try {
        const detail = await enqueue(call);
        setAccount((prev) => withDetail(prev, sessionToken, detail));
        return true;
      } catch (error) {
        toast.error(toErrorMessage(error));
        void refreshAccount(sessionToken);
        return false;
      } finally {
        setAccount((prev) => {
          if (prev?.token !== sessionToken) return prev;
          const pending = Math.max(0, prev.pending - 1);
          return { ...prev, pending, quantities: pending === 0 ? {} : prev.quantities };
        });
      }
    },
    [enqueue, refreshAccount],
  );

  // ── Ações ──────────────────────────────────────────────────────────────────

  /** Aplica uma mudança no carrinho do visitante ou exibe o erro de limite. */
  const commitGuestResult = useCallback((result: GuestCartResult): boolean => {
    if (result.error) {
      toast.error(getMessage(result.error));
      return false;
    }
    commitGuestItems(result.items);
    return true;
  }, []);

  const add = useCallback(
    async (productId: string, quantity: number): Promise<boolean> => {
      if (!token) return commitGuestResult(addGuestItem(getGuestItemsSnapshot(), productId, quantity));

      return runAccountCommand(
        token,
        (state) => {
          const next = accountQuantity(state, productId) + quantity;
          // Soma acima do limite: nada muda na tela, e a API devolve o erro.
          return next <= CART_ITEM_MAX_QUANTITY ? { [productId]: next } : {};
        },
        () => addMyCartItem(token, productId, quantity),
      );
    },
    [token, commitGuestResult, runAccountCommand],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (!token) {
        commitGuestResult(setGuestItemQuantity(getGuestItemsSnapshot(), productId, quantity));
        return;
      }

      if (quantity !== 0 && (!Number.isInteger(quantity) || quantity < 0 || quantity > CART_ITEM_MAX_QUANTITY)) {
        toast.error(getMessage(quantity > CART_ITEM_MAX_QUANTITY ? 'CART_ITEM_QUANTITY_EXCEEDED' : 'CART_ITEM_QUANTITY_INVALID'));
        return;
      }

      void runAccountCommand(
        token,
        () => ({ [productId]: quantity }),
        () => (quantity === 0 ? removeMyCartItem(token, productId) : setMyCartItemQuantity(token, productId, quantity)),
      );
    },
    [token, commitGuestResult, runAccountCommand],
  );

  const remove = useCallback(
    (productId: string) => {
      if (!token) {
        commitGuestResult(removeGuestItem(getGuestItemsSnapshot(), productId));
        return;
      }

      void runAccountCommand(token, () => ({ [productId]: 0 }), () => removeMyCartItem(token, productId));
    },
    [token, commitGuestResult, runAccountCommand],
  );

  const clear = useCallback(async (): Promise<boolean> => {
    if (!token) {
      clearGuestItems();
      return true;
    }

    return runAccountCommand(
      token,
      (state) => Object.fromEntries((state.detail?.lines ?? []).map((line) => [line.productId, 0])),
      () => clearMyCart(token),
    );
  }, [token, runAccountCommand]);

  const refresh = useCallback(() => {
    if (token) void refreshAccount(token);
    else setGuestNonce((nonce) => nonce + 1);
  }, [token, refreshAccount]);

  const open = useCallback(() => {
    setIsOpen(true);
    if (token) void refreshAccount(token);
  }, [token, refreshAccount]);

  const close = useCallback(() => setIsOpen(false), []);

  // ── Estado exibido ─────────────────────────────────────────────────────────

  const value = useMemo<CartContextValue>(() => {
    if (token) {
      const detail = currentAccount?.detail ?? emptyCartDetail();
      const quantities = currentAccount?.quantities ?? {};
      const pending = currentAccount?.pending ?? 0;
      const lines = applyQuantities(detail.lines, (productId) => quantities[productId]);
      // Produtos incluídos na hora que a API ainda não devolveu como linha.
      const listed = new Set(detail.lines.map((line) => line.productId));
      const added = Object.entries(quantities).reduce((sum, [productId, quantity]) => (listed.has(productId) ? sum : sum + quantity), 0);
      const optimisticCount = lines.reduce((sum, line) => sum + line.quantity, 0) + added;

      return {
        detail,
        lines,
        count: pending > 0 ? optimisticCount : detail.itemCount,
        loading: currentAccount?.detail == null,
        isSyncing: pending > 0,
        hasUnavailableItems: lines.some((line) => !line.isAvailable),
        getQuantity: (productId) => accountQuantity(currentAccount, productId),
        add,
        setQuantity,
        remove,
        clear,
        refresh,
        isOpen,
        open,
        close,
      };
    }

    const hasItems = guestItems.length > 0;
    const quantityById = new Map(guestItems.map((item) => [item.productId, item.quantity]));
    const detail = hasItems && guestPreview ? guestPreview.detail : emptyCartDetail();
    const lines = hasItems ? applyQuantities(detail.lines, (productId) => quantityById.get(productId) ?? 0) : [];
    const settled = !hasItems || (guestSettled?.key === guestKey && guestSettled.nonce === guestNonce);
    const previewIsCurrent = guestPreview?.key === guestKey && guestPreview.nonce === guestNonce;
    const localCount = guestItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      detail,
      lines,
      count: hasItems && previewIsCurrent ? detail.itemCount : localCount,
      // Primeira prévia (ou a primeira depois de sair da conta): nenhuma linha a exibir ainda.
      loading: hasItems && lines.length === 0 && !settled,
      isSyncing: !settled,
      hasUnavailableItems: lines.some((line) => !line.isAvailable),
      getQuantity: (productId) => quantityById.get(productId) ?? 0,
      add,
      setQuantity,
      remove,
      clear,
      refresh,
      isOpen,
      open,
      close,
    };
  }, [
    token,
    currentAccount,
    guestItems,
    guestKey,
    guestNonce,
    guestPreview,
    guestSettled,
    add,
    setQuantity,
    remove,
    clear,
    refresh,
    isOpen,
    open,
    close,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de <CartProvider>.');
  }
  return context;
}
