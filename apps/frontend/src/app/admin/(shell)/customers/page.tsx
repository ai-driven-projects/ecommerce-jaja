import { Suspense } from 'react';
import { CustomersPage, CustomersPageSkeleton } from '@/modules/customers/pages/customers.page';

// A lista lê página, busca e status com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<CustomersPageSkeleton />}>
      <CustomersPage />
    </Suspense>
  );
}
