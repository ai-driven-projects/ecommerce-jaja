import type { BadgeProps } from '@/shared/components/ui/badge';
import type { OrderDetail, OrderStatus } from './order.api';

// Rótulos, badges e passos do pedido por status, compartilhados pelo
// acompanhamento do cliente e pelo painel de pedidos do admin. A sequência
// espelha `ORDER_STATUSES` de `@jaja/orders`, que o frontend não importa: mudou
// lá, muda aqui.

/** Nome de cada status como aparece no badge e nos passos. */
export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  PLACED: 'Pedido recebido',
  PAYMENT_APPROVED: 'Pagamento aprovado',
  PICKING: 'Separando na loja',
  OUT_FOR_DELIVERY: 'A caminho',
  DELIVERED: 'Entregue',
};

/** Variante do `Badge` de cada status: verde em andamento, amarelo separando e neutro quando entregue. */
export const ORDER_STATUS_BADGE_VARIANT: Readonly<Record<OrderStatus, NonNullable<BadgeProps['variant']>>> = {
  PLACED: 'success',
  PAYMENT_APPROVED: 'success',
  PICKING: 'warning',
  OUT_FOR_DELIVERY: 'success',
  DELIVERED: 'muted',
};

/** Campo de `OrderDetail` com a data em que o pedido chegou a cada passo. */
export type OrderStepDateKey = 'placedAt' | 'paymentApprovedAt' | 'pickingStartedAt' | 'outForDeliveryAt' | 'deliveredAt';

export type OrderStep = {
  status: OrderStatus;
  label: string;
  dateKey: OrderStepDateKey;
};

/** Passos do pedido, na ordem dos status: status, rótulo e o campo da data do passo. */
export const ORDER_STEPS: readonly OrderStep[] = [
  { status: 'PLACED', label: ORDER_STATUS_LABEL.PLACED, dateKey: 'placedAt' },
  { status: 'PAYMENT_APPROVED', label: ORDER_STATUS_LABEL.PAYMENT_APPROVED, dateKey: 'paymentApprovedAt' },
  { status: 'PICKING', label: ORDER_STATUS_LABEL.PICKING, dateKey: 'pickingStartedAt' },
  { status: 'OUT_FOR_DELIVERY', label: ORDER_STATUS_LABEL.OUT_FOR_DELIVERY, dateKey: 'outForDeliveryAt' },
  { status: 'DELIVERED', label: ORDER_STATUS_LABEL.DELIVERED, dateKey: 'deliveredAt' },
];

/**
 * Situação do passo `index` de `ORDER_STEPS`, derivada só do status:
 * - `done`: os passos até o status atual, inclusive;
 * - `current`: o passo seguinte ao status atual, enquanto o pedido não foi entregue;
 * - `pending`: os demais.
 *
 * A hora de um passo concluído vem da data do passo (`order[step.dateKey]`).
 */
export function orderStepState(order: Pick<OrderDetail, 'status'>, index: number): 'done' | 'current' | 'pending' {
  const currentIndex = ORDER_STEPS.findIndex((step) => step.status === order.status);
  if (index <= currentIndex) return 'done';
  if (index === currentIndex + 1 && !isOrderFinished(order)) return 'current';
  return 'pending';
}

/** `true` quando o pedido chegou ao último passo (`DELIVERED`) e não muda mais. */
export function isOrderFinished(order: Pick<OrderDetail, 'status'>): boolean {
  return order.status === 'DELIVERED';
}
