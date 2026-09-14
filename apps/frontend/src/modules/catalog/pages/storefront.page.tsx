import { Suspense } from 'react';
import { CategoryChipsSkeleton } from '../components/storefront-category-nav.component';
import { ProductGridSkeleton } from '../components/storefront-product-grid.component';
import { Storefront } from '../components/storefront.component';

// Estrutura estática da vitrine (sem shimmer) exibida enquanto o cliente lê a
// query string. `useSearchParams` exige um limite de Suspense no App Router.
function StorefrontSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[34px] px-4 pb-10 pt-3 sm:px-6" aria-hidden="true">
      <CategoryChipsSkeleton />
      <div className="h-[260px] rounded-4xl bg-dark/90" />
      <div>
        <div className="mb-3.5 h-7 w-72 max-w-full rounded-md bg-surface" />
        <ProductGridSkeleton count={6} />
      </div>
    </div>
  );
}

export function StorefrontPage() {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <Storefront />
    </Suspense>
  );
}
