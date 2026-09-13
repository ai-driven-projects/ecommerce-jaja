import { Suspense } from 'react';
import { BrandsPage, BrandsPageSkeleton } from '@/modules/catalog/pages/brands.page';

// A lista lê página e busca com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<BrandsPageSkeleton />}>
      <BrandsPage />
    </Suspense>
  );
}
