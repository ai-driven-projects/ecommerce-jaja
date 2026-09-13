import { Suspense } from 'react';
import { StoresPage, StoresPageSkeleton } from '@/modules/stores/pages/stores.page';

// A lista lê página e busca com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<StoresPageSkeleton />}>
      <StoresPage />
    </Suspense>
  );
}
