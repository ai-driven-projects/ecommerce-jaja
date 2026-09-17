import { Suspense } from 'react';
import { OrdersDashboardSkeleton } from '@/modules/orders/components/orders-dashboard.component';
import { DashboardPage } from '@/modules/orders/pages/dashboard.page';

// A lista lê página, status e busca com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<OrdersDashboardSkeleton />}>
      <DashboardPage />
    </Suspense>
  );
}
