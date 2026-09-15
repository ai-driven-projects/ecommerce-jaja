import { ApiError, apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP do pedido: `/me/orders` (pedidos do usuário da sessão, qualquer
 * usuário autenticado). Cliente, itens e preços vêm sempre do servidor: o
 * navegador só envia quem recebe e as instruções para o entregador. Os tipos
 * espelham os DTOs de `@jaja/orders`, que o frontend não importa. Funções puras
 * sobre `apiRequest`, que lançam `ApiError` em resposta com erro.
 */

/** Status do pedido (`ORDER_STATUSES`); nesta versão só existe `PLACED` ("Pedido recebido"). */
export type OrderStatus = 'PLACED';

/** Item do pedido (`OrderItemDTO`), congelado na confirmação. */
export type OrderItem = {
  productId: string;
  /** Nome e unidade do produto na hora do pedido. */
  name: string;
  unit: string;
  /** Miniatura da imagem principal, ou `null` quando o produto não tinha imagens. */
  thumbUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  /** `unitPriceCents * quantity`. */
  lineTotalCents: number;
};

/** Cópia do endereço do cliente feita na confirmação (`OrderDeliveryAddressDTO`). */
export type OrderDeliveryAddress = {
  /** 8 dígitos. */
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  /** UF em maiúsculas. */
  state: string;
};

/** Pedido como exibido ao cliente (`OrderDetailDTO`), com os totais gravados, em centavos, e datas em ISO. */
export type OrderDetail = {
  id: string;
  customerId: string;
  status: OrderStatus;
  /** Na ordem do carrinho na confirmação. */
  items: OrderItem[];
  deliveryAddress: OrderDeliveryAddress;
  recipientName: string;
  /** `null` quando o cliente não enviou instruções. */
  deliveryInstructions: string | null;
  /** Soma das quantidades. */
  itemCount: number;
  subtotalCents: number;
  /** 0 quando a entrega é grátis. */
  deliveryFeeCents: number;
  totalCents: number;
  placedAt: string;
};

/**
 * Corpo de `POST /me/orders`. `recipientName` vazio usa o nome do usuário;
 * `deliveryInstructions` vazio vira `null`.
 */
export type PlaceOrderInput = {
  recipientName?: string;
  deliveryInstructions?: string;
};

const MY_ORDERS_PATH = '/me/orders';

function myOrderPath(orderId: string): string {
  return `${MY_ORDERS_PATH}/${encodeURIComponent(orderId)}`;
}

/**
 * Confirma o pedido a partir do carrinho da conta, que o servidor esvazia na
 * mesma transação. Devolve o pedido criado. Falhas de cadastro de cliente
 * (`ORDER_CUSTOMER_*`), de carrinho (`ORDER_CART_*`) e de validação respondem `400`.
 */
export function placeMyOrder(token: string, input: PlaceOrderInput): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(MY_ORDERS_PATH, { method: 'POST', token, body: input });
}

/**
 * Pedido do usuário da sessão, ou `null` quando não foi encontrado
 * (`404 ORDER_NOT_FOUND`: inexistente, de outro usuário ou id malformado). Os
 * demais erros são propagados.
 */
export async function getMyOrder(token: string, orderId: string): Promise<OrderDetail | null> {
  try {
    return await apiRequest<OrderDetail>(myOrderPath(orderId), { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.codes.includes('ORDER_NOT_FOUND')) {
      return null;
    }
    throw error;
  }
}
