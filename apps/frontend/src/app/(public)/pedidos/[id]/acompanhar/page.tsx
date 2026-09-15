import type { Metadata } from 'next';
import { formatOrderNumber } from '@/modules/orders/data/order.util';
import { TrackingPage } from '@/modules/orders/pages/tracking.page';

type TrackingRouteProps = {
  params: Promise<{ id: string }>;
};

// No servidor não há sessão: o título usa só o id da URL, sem chamar a API.
export async function generateMetadata({ params }: TrackingRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Pedido #${formatOrderNumber(id)} — já já` };
}

/**
 * Acompanhamento de um pedido do cliente autenticado, lido da API no navegador
 * (`GET /me/orders/:id`). Rota pública, sem redirecionamento: sem sessão, a
 * página pede para entrar.
 */
export default async function TrackingRoute({ params }: TrackingRouteProps) {
  const { id } = await params;
  return <TrackingPage orderId={id} />;
}
