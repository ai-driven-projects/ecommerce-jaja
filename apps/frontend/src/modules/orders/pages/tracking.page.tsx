import { OrderTracking } from '../components/order-tracking.component';

export function TrackingPage({ orderId }: { orderId: string }) {
  return <OrderTracking orderId={orderId} />;
}
