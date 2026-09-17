import { OrderMonitor } from '../components/order-monitor.component';

type OrderMonitorPageProps = {
  orderId: string;
  /** Query string da lista de origem, mantida no link "← Pedidos". */
  returnQuery?: string;
};

/** Painel ao vivo de um pedido no admin: progresso, cliente, itens e a linha do tempo dos eventos. */
export function OrderMonitorPage({ orderId, returnQuery }: OrderMonitorPageProps) {
  return <OrderMonitor orderId={orderId} returnQuery={returnQuery} />;
}
