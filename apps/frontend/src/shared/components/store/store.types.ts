/**
 * Tipos mínimos dos componentes de loja. Ficam no shared para não acoplar os
 * componentes aos módulos `catalog` e `orders`; os módulos mapeiam seus tipos
 * para estes.
 */

export type StoreProduct = {
  id: string;
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

/** Linha exibida do carrinho, com os dados atuais do produto. */
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  /** Slug da categoria raiz: tom e emoji de reserva da área de imagem. */
  category: string;
  /** Foto do produto (miniatura); sem ela, o emoji da categoria. */
  imageUrl: string | null;
  /** Preço unitário atual. */
  priceCents: number;
  quantity: number;
  /** Total da linha; `null` quando o produto está indisponível. */
  lineTotalCents: number | null;
  isAvailable: boolean;
};

export type Zone = {
  neighborhood: string;
  store: string;
};

export type CartTotals = {
  /** Soma das quantidades de todas as linhas, inclusive as indisponíveis. */
  itemCount: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  /** Quanto falta para a entrega grátis (0 quando já é grátis). */
  missingForFreeDeliveryCents: number;
};
