import { apiRequest } from '@/shared/util/api-client.util';
import type { OrderStatus } from '@/modules/orders/data/order.api';

/**
 * Cliente HTTP do teste de carga: `/dev/load-test` (só administradores, e só com
 * `DEV_TOOLS_ENABLED="true"` no backend; desligado responde `404
 * DEV_TOOLS_DISABLED`). Os tipos espelham `@jaja/dev` e
 * `apps/backend/src/modules/dev/load-test-http.ts`, que o frontend não importa:
 * mudou lá, muda aqui. Datas chegam em ISO 8601.
 */

/** Quantos produtos visíveis e clientes ativos entram no sorteio dos pedidos. */
export type LoadTestPoolSummary = {
  products: number;
  customers: number;
};

/** Resposta de cada pedido disparado: o pedido criado e o tempo gasto dentro da API. */
export type LoadTestOrderPlaced = {
  runId: string;
  orderId: string;
  /** Plano + `PlaceOrder` no servidor, em ms (sem rede nem fila de conexões). */
  serverMs: number;
};

/** Pedido de uma execução, como a fila o mostra. */
export type LoadTestRunOrder = {
  id: string;
  status: OrderStatus;
  placedAt: string;
  /** Data do passo mais recente, ou `placedAt`. */
  statusChangedAt: string;
  deliveredAt: string | null;
};

/** Todos os pedidos de uma execução, do mais antigo para o mais novo, e a contagem por status. */
export type LoadTestRun = {
  runId: string;
  total: number;
  /** Só os status presentes. */
  byStatus: Partial<Record<OrderStatus, number>>;
  orders: LoadTestRunOrder[];
};

const LOAD_TEST_PATH = '/dev/load-test';

/** Tamanho do sorteio; também diz se as ferramentas estão ligadas (`404 DEV_TOOLS_DISABLED` quando não). */
export function getLoadTestPool(token: string): Promise<LoadTestPoolSummary> {
  return apiRequest<LoadTestPoolSummary>(`${LOAD_TEST_PATH}/pool`, { token });
}

/** Faz **um** pedido da execução `runId` (um uuid); a tela dispara quantos quiser ao mesmo tempo. */
export function placeLoadTestOrder(token: string, runId: string): Promise<LoadTestOrderPlaced> {
  return apiRequest<LoadTestOrderPlaced>(`${LOAD_TEST_PATH}/orders`, { method: 'POST', token, body: { runId } });
}

/** Pedidos da execução com o status atual; execução desconhecida volta vazia. */
export function getLoadTestRun(token: string, runId: string): Promise<LoadTestRun> {
  return apiRequest<LoadTestRun>(`${LOAD_TEST_PATH}/runs/${encodeURIComponent(runId)}`, { token });
}
