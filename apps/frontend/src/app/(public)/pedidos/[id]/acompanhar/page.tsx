import type { Metadata } from 'next';
import { TrackingPage } from '@/modules/orders/pages/tracking.page';

type TrackingRouteProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: TrackingRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Pedido #${id} — já já` };
}

/** Acompanhamento público de um pedido, com dados locais de exemplo. */
export default async function TrackingRoute({ params }: TrackingRouteProps) {
  const { id } = await params;
  return <TrackingPage orderId={id} />;
}
