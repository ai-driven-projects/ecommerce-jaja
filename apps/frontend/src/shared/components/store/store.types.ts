/**
 * Tipos mínimos dos componentes de loja. Ficam no shared para não acoplar os
 * componentes ao módulo `catalog`; o módulo mapeia seus tipos para estes.
 */

export type StoreProduct = {
  slug: string;
  name: string;
  /** Slug da categoria raiz: só define o tom e o emoji de reserva da área de imagem. */
  category: string;
  priceCents: number;
  /** Preço anterior, quando o produto está em oferta. */
  oldPriceCents?: number | null;
  unit: string;
  /** Emoji de reserva da área de imagem; sem ele, vale o da categoria. */
  emoji?: string;
  /** Foto do produto (miniatura); sem ela, ou quando não carrega, o emoji. */
  imageUrl?: string | null;
  /** Desconto informado pela API; ausente, o card calcula pelo preço "De:". */
  discountPercent?: number | null;
  /** Selo "Destaque" quando não há desconto. */
  badge?: 'featured' | null;
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
  store: string;
};

export type CartTotals = {
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  /** Quanto falta para a entrega grátis (0 quando já é grátis). */
  missingForFreeDeliveryCents: number;
};
