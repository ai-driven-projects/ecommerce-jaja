import type { CartItemInput } from './cart.api';
import { CART_ITEM_MAX_QUANTITY, CART_MAX_ITEMS } from './cart.util';

// ── Store externo do carrinho do visitante ────────────────────────────────────
// A lista vive fora do React (módulo + localStorage) e entra via
// `useSyncExternalStore`: o servidor e a hidratação veem a lista vazia, e o
// conteúdo salvo aparece logo depois, sem divergência de markup. O evento
// `storage` sincroniza as abas; sem `localStorage`, a lista fica em memória.

const STORAGE_KEY = 'jaja.guest-cart';
/** Carrinho das versões anteriores da loja (`{ slug: quantidade }` do mock), descartado. */
const LEGACY_STORAGE_KEY = 'jaja.cart';

const EMPTY: readonly CartItemInput[] = Object.freeze([]);
const listeners = new Set<() => void>();
let cachedItems: readonly CartItemInput[] | null = null;
let listeningToStorage = false;

/**
 * Normaliza o conteúdo salvo: descarta entradas sem `productId` texto ou sem
 * quantidade inteira ≥ 1, soma `productId` repetido, limita a 99 unidades e
 * mantém os primeiros 50 produtos, na ordem salva.
 */
function normalizeItems(value: unknown): readonly CartItemInput[] {
  if (!Array.isArray(value)) return EMPTY;

  const quantities = new Map<string, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const { productId, quantity } = entry as Record<string, unknown>;
    if (typeof productId !== 'string' || productId.trim() === '') continue;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) continue;

    const key = productId.trim().toLowerCase();
    if (!quantities.has(key) && quantities.size >= CART_MAX_ITEMS) continue;
    quantities.set(key, Math.min(CART_ITEM_MAX_QUANTITY, (quantities.get(key) ?? 0) + quantity));
  }

  if (quantities.size === 0) return EMPTY;
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

function readStoredItems(): readonly CartItemInput[] {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeItems(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

// Outra aba gravou (ou apagou) o carrinho: relê e avisa os assinantes.
function handleStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cachedItems = readStoredItems();
  notify();
}

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!listeningToStorage && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
    listeningToStorage = true;
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && listeningToStorage) {
      window.removeEventListener('storage', handleStorage);
      listeningToStorage = false;
      // Sem assinantes, outra aba pode mudar a lista sem aviso: relê na próxima leitura.
      cachedItems = null;
    }
  };
}

/** Chave estável de uma lista de itens, para comparar conteúdos. */
export function guestItemsKey(items: readonly CartItemInput[]): string {
  return items.map((item) => `${item.productId}:${item.quantity}`).join(',');
}

/** Itens do visitante, na ordem de inclusão. A referência só muda quando a lista muda. */
export function getGuestItemsSnapshot(): readonly CartItemInput[] {
  if (cachedItems === null) cachedItems = readStoredItems();
  return cachedItems;
}

/** No servidor e na hidratação, o carrinho do visitante é vazio. */
export function getGuestItemsServerSnapshot(): readonly CartItemInput[] {
  return EMPTY;
}

/** Grava a lista (já validada pelas regras de `cart.util.ts`) e avisa os assinantes. */
export function commitGuestItems(items: readonly CartItemInput[]) {
  const next = items.length === 0 ? EMPTY : normalizeItems(items);
  // Mesmo conteúdo: mantém a referência para não disparar uma nova prévia.
  if (guestItemsKey(next) === guestItemsKey(getGuestItemsSnapshot())) return;
  cachedItems = next;
  try {
    if (next.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Sem persistência: o carrinho continua em memória.
  }
  notify();
}

/** Apaga o carrinho do visitante (depois da mescla na conta). */
export function clearGuestItems() {
  commitGuestItems(EMPTY);
}
