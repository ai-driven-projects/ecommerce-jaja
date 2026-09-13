import { Suspense } from 'react';
import { ProductsPage, ProductsPageSkeleton } from '@/modules/catalog/pages/products.page';

// A listagem lê página e filtros com `useSearchParams`, que exige `<Suspense>` no build.
export default function Page() {
  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ProductsPage />
    </Suspense>
  );
}
