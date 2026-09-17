import { COURIERS_ONLINE, PRODUCTS, type Product } from '@/modules/catalog/data';

/**
 * Dados locais de exemplo do dashboard administrativo que ainda não vêm da API:
 * entregadores online e "Estoque baixo". Pedidos, indicadores do dia, "Pedidos
 * em andamento" e o contador do menu vêm do resumo de pedidos
 * (`useOrdersSummary`, em `@/modules/orders`). Quando houver endpoints de
 * entregadores e estoque, só este arquivo muda.
 */

export type LowStockProduct = Product & {
  /** Estoque considerado cheio, para a barra de progresso. */
  capacity: number;
};

export const LOW_STOCK_THRESHOLD = 25;

export const LOW_STOCK_PRODUCTS: readonly LowStockProduct[] = PRODUCTS.filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
  .sort((a, b) => a.stock - b.stock)
  .slice(0, 4)
  .map((product) => ({ ...product, capacity: Math.max(60, Math.ceil(product.stock / 0.2)) }));

export { COURIERS_ONLINE };
