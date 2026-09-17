import { ApiError, apiRequest } from '@/shared/util/api-client.util';
import type { OrderDetail, OrderStatus } from './order.api';

/**
 * Cliente HTTP da administração de pedidos: `/orders` (só administradores; `401`
 * sem sessão e `403 ADMIN_REQUIRED` para quem não é administrador). Só leituras:
 * nenhuma chamada altera pedidos. Os tipos espelham os DTOs de `@jaja/orders`
 * (`OrderListItemDTO`, `OrderPageDTO`, `OrderAdminDetailDTO`, `OrdersSummaryDTO`)
 * e a linha do tempo de `apps/backend/src/messaging/monitoring`, que o frontend
 * não importa: mudou lá, muda aqui. Datas chegam em ISO 8601. Funções puras sobre
 * `apiRequest`, que lançam `ApiError` em resposta com erro.
 */

/** Linha da lista administrativa e de `OrdersSummary.latestInProgress` (`OrderListItemDTO`). */
export type OrderListItem = {
  id: string;
  status: OrderStatus;
  /** Nome do usuário do cliente. */
  customerName: string;
  /** Bairro e cidade do endereço copiado no pedido. */
  deliveryNeighborhood: string;
  deliveryCity: string;
  /** Soma das quantidades. */
  itemCount: number;
  totalCents: number;
  placedAt: string;
  /** Data do passo mais recente (`deliveredAt`, `outForDeliveryAt`, `pickingStartedAt`, `paymentApprovedAt`) ou `placedAt`. */
  statusChangedAt: string;
};

/** Filtro de status da lista: um status, ou `IN_PROGRESS` (qualquer status diferente de `DELIVERED`). */
export type OrderStatusFilter = OrderStatus | 'IN_PROGRESS';

/** Parâmetros de `GET /orders`; ausentes usam os padrões da API (página 1, 20 por página). */
export type OrderFilters = {
  page?: number;
  pageSize?: number;
  status?: OrderStatusFilter;
  /** Número do pedido (começo do id sem hífens) ou parte do nome do cliente. */
  search?: string;
};

/** Página da lista administrativa (`OrderPageDTO`), no mesmo formato da página de clientes. */
export type OrderPage = {
  items: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Cliente do pedido como a operação o vê (`OrderAdminCustomerDTO`). */
export type OrderAdminCustomer = {
  /** `customers.id`. */
  id: string;
  name: string;
  email: string;
  /** Só dígitos (formatado na tela). */
  phone: string;
};

/** Pedido de qualquer cliente para o painel (`OrderAdminDetailDTO`): o detalhe do cliente + quem pediu + última gravação. */
export type OrderAdminDetail = OrderDetail & {
  customer: OrderAdminCustomer;
  updatedAt: string;
};

/** Indicadores do dia da operação (`OrdersSummaryDTO`), com "hoje" no fuso `America/Sao_Paulo`. */
export type OrdersSummary = {
  /** Pedidos feitos hoje. */
  placedToday: number;
  /** Pedidos de qualquer dia com status diferente de `DELIVERED`. */
  inProgress: number;
  /** Pedidos entregues hoje. */
  deliveredToday: number;
  /** Soma de `totalCents` dos pedidos de hoje. */
  revenueTodayCents: number;
  /** Média inteira de `totalCents` dos pedidos de hoje, ou `null` sem pedidos hoje. */
  averageTicketTodayCents: number | null;
  /** Média de `deliveredAt - placedAt` dos entregues hoje, em minutos com uma casa, ou `null` sem entregas hoje. */
  averageDeliveryMinutesToday: number | null;
  /** Até 6 pedidos em andamento, do mais recente para o mais antigo. */
  latestInProgress: OrderListItem[];
};

/**
 * Estado de um consumidor para um evento, derivado do banco:
 * - `processed`: há a marca de processamento do consumidor;
 * - `event-pending`: sem marca, e o evento ainda não saiu do outbox;
 * - `waiting`: sem marca, com o evento publicado (esperando na fila `.wait` ou
 *   processando). Novas tentativas e descartes não são distinguidos: vivem no broker.
 */
export type EventTimelineConsumerState = 'event-pending' | 'waiting' | 'processed';

/** Consumidor de um evento na linha do tempo. */
export type EventTimelineConsumer = {
  /** `<módulo>.<ação>` (ex.: `payment.approve-order`). */
  name: string;
  /** Espera do consumidor registrado nesta instância; `null` quando não registrado ou sem espera. */
  delayMs: number | null;
  /** `false` para quem processou o evento sem estar registrado na instância que respondeu. */
  registered: boolean;
  processedAt: string | null;
  /** `publishedAt + delayMs`, ou `null` sem os dois. */
  expectedAt: string | null;
  state: EventTimelineConsumerState;
};

/** Situação do evento no outbox. */
export type EventTimelineOutbox = {
  /** `PENDING` ou `PUBLISHED`. */
  status: string;
  attempts: number;
  availableAt: string;
  publishedAt: string | null;
  lastError: string | null;
};

/** Evento do pedido na linha do tempo (`EventTimelineEntry`), lido das tabelas de mensageria. */
export type EventTimelineEntry = {
  /** Id do evento, que é também o `messageId` da mensagem no broker. */
  id: string;
  type: string;
  occurredAt: string;
  payload: unknown;
  metadata: unknown;
  /** Do `metadata`, ou `null` (o primeiro evento da cadeia não tem causa). */
  causationId: string | null;
  correlationId: string | null;
  outbox: EventTimelineOutbox;
  /** Registrados para o `type` (na ordem de registro) e, depois, os não registrados que processaram. */
  consumers: EventTimelineConsumer[];
};

const ORDERS_PATH = '/orders';

/**
 * Caminho do stream administrativo de avisos (`GET /orders/stream`), para
 * `openEventStream`, que envia o token no cabeçalho e nunca na URL. Cada evento
 * `order` traz só `{ orderId, eventType, messageId, occurredAt }` (`OrderStreamNotice`).
 */
export const ORDERS_STREAM_PATH = `${ORDERS_PATH}/stream`;

function orderPath(orderId: string): string {
  return `${ORDERS_PATH}/${encodeURIComponent(orderId)}`;
}

/** `404 ORDER_NOT_FOUND`: pedido inexistente, excluído ou id malformado. */
function isOrderNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.codes.includes('ORDER_NOT_FOUND');
}

/** Página de pedidos de todos os clientes, do mais recente para o mais antigo. Filtro e busca vazios não vão para a URL. */
export function listOrders(token: string, filters: OrderFilters = {}): Promise<OrderPage> {
  const params = new URLSearchParams();
  const search = filters.search?.trim();

  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.status) params.set('status', filters.status);
  if (search) params.set('search', search);

  const query = params.toString();
  return apiRequest<OrderPage>(query ? `${ORDERS_PATH}?${query}` : ORDERS_PATH, { token });
}

/** Resumo do dia da operação e os últimos pedidos em andamento. */
export function getOrdersSummary(token: string): Promise<OrdersSummary> {
  return apiRequest<OrdersSummary>(`${ORDERS_PATH}/summary`, { token });
}

/** Pedido de qualquer cliente, ou `null` no `404 ORDER_NOT_FOUND`. Os demais erros são propagados. */
export async function getOrder(token: string, orderId: string): Promise<OrderAdminDetail | null> {
  try {
    return await apiRequest<OrderAdminDetail>(orderPath(orderId), { token });
  } catch (error) {
    if (isOrderNotFound(error)) return null;
    throw error;
  }
}

/**
 * Linha do tempo dos eventos do pedido, em ordem cronológica, ou `null` no `404
 * ORDER_NOT_FOUND` (a API confere o pedido antes). Os demais erros são propagados.
 */
export async function getOrderEvents(token: string, orderId: string): Promise<EventTimelineEntry[] | null> {
  try {
    return await apiRequest<EventTimelineEntry[]>(`${orderPath(orderId)}/events`, { token });
  } catch (error) {
    if (isOrderNotFound(error)) return null;
    throw error;
  }
}
