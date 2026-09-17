import { ApiError, apiRequest } from '@/shared/util/api-client.util';

/**
 * Cliente HTTP do pedido: `/me/orders` (pedidos do usuário da sessão, qualquer
 * usuário autenticado). Cliente, itens e preços vêm sempre do servidor: o
 * navegador só envia quem recebe e as instruções para o entregador. Os tipos
 * espelham os DTOs de `@jaja/orders`, que o frontend não importa. Funções puras
 * sobre `apiRequest`, que lançam `ApiError` em resposta com erro.
 */

/**
 * Status do pedido (`ORDER_STATUSES`), na sequência em que o pedido avança, um
 * passo por vez: recebido, pagamento aprovado, separando na loja, a caminho e
 * entregue. Rótulos, badges e passos em `order-status.util.ts`.
 */
export type OrderStatus = 'PLACED' | 'PAYMENT_APPROVED' | 'PICKING' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

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
  /** Data de cada passo: `placedAt` sempre; as demais `null` enquanto o pedido não chegou ao status. */
  placedAt: string;
  paymentApprovedAt: string | null;
  pickingStartedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
};

/**
 * `data` do evento `order` de `GET /me/orders/:id/stream`: só avisa que um evento
 * do pedido foi publicado, sem dados do pedido. O estado é relido por `getMyOrder`.
 */
export type OrderStreamNotice = {
  orderId: string;
  /** Tipo do evento (ex.: `order.payment-approved`). */
  eventType: string;
  messageId: string;
  /** ISO 8601. */
  occurredAt: string;
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
 * Caminho do stream de avisos do pedido (`/me/orders/<id codificado>/stream`),
 * para `openEventStream`, que envia o token no cabeçalho e nunca na URL. A API
 * confere o dono antes de abrir: `401` sem sessão e `404` para pedido inexistente
 * ou de outro usuário.
 */
export function myOrderStreamPath(orderId: string): string {
  return `${myOrderPath(orderId)}/stream`;
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
