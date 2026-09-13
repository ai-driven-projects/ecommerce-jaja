import { Suspense } from 'react';
import { Storefront } from '../components/storefront.component';
import { CATEGORY_OPTIONS } from '../data/storefront.mock';

// Estrutura estática da vitrine (sem shimmer) exibida enquanto o cliente lê a
// query string. `useSearchParams` exige um limite de Suspense no App Router.
function StorefrontSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[34px] px-4 pb-10 pt-3 text-placeholder sm:px-6" aria-hidden="true">
      <div className="flex gap-2 overflow-hidden">
        {CATEGORY_OPTIONS.map((option) => (
          <span key={option.id} className="shrink-0 rounded-pill border border-line bg-card px-[15px] py-2 text-[13.5px] font-bold">
            {option.emoji} {option.label}
          </span>
        ))}
      </div>
      <div className="h-[260px] rounded-4xl bg-dark/90" />
      <div>
        <div className="mb-3.5 h-7 w-72 rounded-md bg-surface" />
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-3">
              <div className="h-[120px] rounded-xl bg-surface" />
              <div className="h-4 w-3/4 rounded-md bg-surface" />
              <div className="h-3 w-1/2 rounded-md bg-surface" />
              <div className="mt-1 flex items-center justify-between">
                <div className="h-5 w-16 rounded-md bg-surface" />
                <div className="size-8 rounded-full border-[1.5px] border-line" />
              </div>
            </div>
          ))}
        </div>
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
