import { Badge } from '@/shared/components/ui/badge';
import { ORDER_STATUS_LABEL, type OrderStatus } from '../data/dashboard.mock';

const VARIANT_BY_STATUS: Record<OrderStatus, 'warning' | 'success' | 'muted' | 'danger'> = {
  separando: 'warning',
  caminho: 'success',
  entregue: 'muted',
  atrasado: 'danger',
};

/** Etiqueta de status de pedido, com a cor do estado. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status]} className="justify-center px-[11px] py-1">
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Entregador com o emoji do modo (bike ou a pé). */
export function CourierCell({ mode, name }: { mode: 'bike' | 'foot'; name: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap font-bold">
      <span className="text-[15px]" aria-label={mode === 'bike' ? 'de bike' : 'a pé'}>
        {mode === 'bike' ? '🚴' : '🚶'}
      </span>
      {name}
    </span>
  );
}
