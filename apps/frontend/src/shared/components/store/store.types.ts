/**
 * Tipos mínimos dos componentes de loja. Ficam no shared para não acoplar os
 * componentes ao módulo `catalog`; o módulo mapeia seus tipos para estes.
 */

export type StoreProduct = {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  /** Preço anterior, quando o produto está em oferta. */
  oldPriceCents?: number | null;
  unit: string;
  /** Emoji que representa o produto na área de imagem. */
  emoji: string;
};

export type CartItem = {
  productId: string;
  name: string;
  category: string;
  emoji: string;
  priceCents: number;
  quantity: number;
};

/** @deprecated Use `CartItem`. */
export type BagItem = CartItem;

export type Zone = {
  neighborhood: string;
  hub: string;
};

export type CartTotals = {
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  /** Quanto falta para a entrega grátis (0 quando já é grátis). */
  missingForFreeDeliveryCents: number;
};
