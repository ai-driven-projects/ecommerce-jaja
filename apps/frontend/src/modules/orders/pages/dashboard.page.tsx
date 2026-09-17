import { OrdersDashboardComponent } from '../components/orders-dashboard.component';

/** Lista de pedidos ao vivo do admin. Precisa estar dentro de `<Suspense>` (usa `useSearchParams`). */
export function DashboardPage() {
  return <OrdersDashboardComponent />;
}
