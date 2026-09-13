'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { CartItem, CartTotals } from '@/shared/components/store/store.types';
import { calculateCartTotals } from '@/shared/util/cart.util';
import { findProduct } from './storefront.mock';

const STORAGE_KEY = 'jaja.cart';

/** Quantidade por slug de produto. */
type CartState = Readonly<Record<string, number>>;

// ── Store externo ─────────────────────────────────────────────────────────────
// O carrinho vive fora do React (módulo + localStorage) e entra via
// `useSyncExternalStore`: o servidor e a hidratação veem o carrinho vazio, e o
// conteúdo salvo aparece logo depois, sem divergência de markup.

const EMPTY: CartState = {};
const listeners = new Set<() => void>();
let cachedState: CartState | null = null;

function readStoredCart(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    // Ignora slugs que não existem mais no catálogo.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([slug, quantity]) => typeof quantity === 'number' && quantity > 0 && findProduct(slug),
      ),
    ) as CartState;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): CartState {
  if (cachedState === null) cachedState = readStoredCart();
  return cachedState;
}

function getServerSnapshot(): CartState {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function commit(next: CartState) {
  cachedState = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sem persistência: o carrinho continua em memória.
  }
  listeners.forEach((listener) => listener());
}

function updateQuantity(slug: string, quantity: number) {
  const next = { ...getSnapshot() };
  if (quantity <= 0) delete next[slug];
  else next[slug] = quantity;
  commit(next);
}

// ── Contexto ──────────────────────────────────────────────────────────────────

type CartContextValue = {
  items: CartItem[];
  count: number;
  totals: CartTotals;
  getQuantity: (slug: string) => number;
  setQuantity: (slug: string, quantity: number) => void;
  add: (slug: string, quantity?: number) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Carrinho da loja, persistido no navegador, com o estado aberto/fechado da gaveta. */
export function CartProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);

  const setQuantity = useCallback((slug: string, quantity: number) => updateQuantity(slug, quantity), []);
  const add = useCallback((slug: string, quantity = 1) => updateQuantity(slug, (getSnapshot()[slug] ?? 0) + quantity), []);
  const clear = useCallback(() => commit(EMPTY), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const items = useMemo<CartItem[]>(
    () =>
      Object.entries(state).flatMap(([slug, quantity]) => {
        const product = findProduct(slug);
        if (!product) return [];
        return [
          {
            productId: slug,
            name: product.name,
            category: product.category,
            emoji: product.emoji,
            priceCents: product.priceCents,
            quantity,
          },
        ];
      }),
    [state],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      totals: calculateCartTotals(items),
      getQuantity: (slug) => state[slug] ?? 0,
      setQuantity,
      add,
      clear,
      isOpen,
      open,
      close,
    }),
    [items, state, setQuantity, add, clear, isOpen, open, close],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de <CartProvider>.');
  }
  return context;
}
