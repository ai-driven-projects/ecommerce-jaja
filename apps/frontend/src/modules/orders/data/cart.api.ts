import { apiRequest } from '@/shared/util/api-client.util';
import { emptyCartDetail } from './cart.util';

/**
 * Cliente HTTP do carrinho: `/me/cart` (carrinho da conta do usuário da
 * sessão, qualquer usuário autenticado) e `POST /cart/preview` (prévia pública
 * do carrinho do visitante). Toda resposta de sucesso é o carrinho completo
 * (`CartDetailDTO`), calculado pela API com o preço atual e a disponibilidade
 * de cada produto. Funções puras sobre `apiRequest`, que lançam `ApiError` em
 * resposta com erro.
 */

/** Item enviado pelo navegador (`CartItemInputDTO`): usado pela prévia e pela mescla. */
export type CartItemInput = {
  productId: string;
  quantity: number;
};

/** Linha do carrinho (`CartLineDTO`), com os dados atuais do catálogo. */
export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  /** Slug da categoria raiz: tom e emoji de reserva da área de imagem. */
  rootCategorySlug: string;
  /** Miniatura da imagem principal. */
  thumbUrl: string | null;
  priceCents: number;
  listPriceCents: number | null;
  quantity: number;
  /** Produto visível na loja; indisponível fica fora dos totais. */
  isAvailable: boolean;
  /** `priceCents * quantity`, ou `null` quando indisponível. */
  lineTotalCents: number | null;
};

/** Carrinho com linhas e totais (`CartDetailDTO`), em centavos. */
export type CartDetail = {
  /** Na ordem de inclusão. */
  lines: CartLine[];
  /** Soma das quantidades de todas as linhas, inclusive as indisponíveis. */
  itemCount: number;
  /** Só das linhas disponíveis. */
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  freeDeliveryThresholdCents: number;
  /** Quanto falta para a entrega grátis (0 quando já é grátis). */
  missingForFreeDeliveryCents: number;
  hasUnavailableItems: boolean;
};

const MY_CART_PATH = '/me/cart';
const MY_CART_ITEMS_PATH = `${MY_CART_PATH}/items`;

function myCartItemPath(productId: string): string {
  return `${MY_CART_ITEMS_PATH}/${encodeURIComponent(productId)}`;
}

/** Carrinho da conta; vazio quando o usuário ainda não tem um. */
export function getMyCart(token: string): Promise<CartDetail> {
  return apiRequest<CartDetail>(MY_CART_PATH, { token });
}

/**
 * Soma `quantity` à quantidade do produto (ou o inclui no fim). Soma acima de
 * 99 → `CART_ITEM_QUANTITY_EXCEEDED`; produto indisponível → `CART_PRODUCT_NOT_FOUND`.
 */
export function addMyCartItem(token: string, productId: string, quantity: number): Promise<CartDetail> {
  return apiRequest<CartDetail>(MY_CART_ITEMS_PATH, { method: 'POST', token, body: { productId, quantity } });
}

/** Define a quantidade do produto, mantendo a posição (ou o inclui no fim). */
export function setMyCartItemQuantity(token: string, productId: string, quantity: number): Promise<CartDetail> {
  return apiRequest<CartDetail>(myCartItemPath(productId), { method: 'PUT', token, body: { quantity } });
}

/** Remove o produto, disponível ou não; produto ausente devolve o carrinho igual. */
export function removeMyCartItem(token: string, productId: string): Promise<CartDetail> {
  return apiRequest<CartDetail>(myCartItemPath(productId), { method: 'DELETE', token });
}

/** Esvazia o carrinho da conta. */
export function clearMyCart(token: string): Promise<CartDetail> {
  return apiRequest<CartDetail>(MY_CART_PATH, { method: 'DELETE', token });
}

/** Junta ao carrinho da conta os itens do visitante; itens inválidos ou indisponíveis são ignorados. */
export function mergeMyCart(token: string, items: CartItemInput[]): Promise<CartDetail> {
  return apiRequest<CartDetail>(`${MY_CART_PATH}/merge`, { method: 'POST', token, body: { items } });
}

/**
 * Linhas e totais do carrinho do visitante, sem token. Lista vazia devolve o
 * carrinho vazio sem chamar a API. Produto inexistente não volta como linha.
 */
export async function previewCart(items: CartItemInput[]): Promise<CartDetail> {
  if (items.length === 0) return emptyCartDetail();
  return apiRequest<CartDetail>('/cart/preview', { method: 'POST', body: { items } });
}
