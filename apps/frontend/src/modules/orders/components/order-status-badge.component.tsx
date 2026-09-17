import { Badge } from '@/shared/components/ui/badge';
import type { OrderStatus } from '../data/order.api';
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABEL } from '../data/order-status.util';

type OrderStatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

/**
 * Badge do status do pedido com o rótulo e a cor de `order-status.util.ts`
 * ("Pedido recebido", "Pagamento aprovado" e "A caminho" em verde, "Separando na
 * loja" em amarelo e "Entregue" neutro), no acompanhamento e no admin.
 */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <Badge variant={ORDER_STATUS_BADGE_VARIANT[status]} className={className}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}
