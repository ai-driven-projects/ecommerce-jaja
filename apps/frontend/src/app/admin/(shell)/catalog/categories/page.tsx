import { Suspense } from 'react';
import { CategoriesPage, CategoriesPageSkeleton } from '@/modules/catalog/pages/categories.page';

// A lista lê página e busca com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<CategoriesPageSkeleton />}>
      <CategoriesPage />
    </Suspense>
  );
}
