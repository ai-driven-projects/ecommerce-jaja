import { Suspense } from 'react';
import { ProductDetail } from '../components/product-detail.component';
import type { Product } from '../data/storefront.types';

// Estrutura estática do detalhe (sem shimmer) enquanto a query string é lida.
function ProductSkeleton({ product }: { product: Product }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-[22px] text-placeholder sm:px-6" aria-hidden="true">
      <div className="mb-[18px] h-4 w-64 rounded-md bg-surface" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="h-[280px] rounded-4xl bg-surface sm:h-[380px]" />
        <div>
          <h1 className="mb-1.5 font-display text-[32px] font-extrabold leading-[1.15] tracking-[-0.8px]">{product.name}</h1>
          <p className="mb-[18px] text-[14.5px]">{product.unit}</p>
          <div className="mb-5 h-10 w-40 rounded-md bg-surface" />
          <div className="mb-3.5 flex gap-3">
            <div className="h-[52px] w-[140px] rounded-pill bg-surface" />
            <div className="h-[52px] flex-1 rounded-pill bg-brand-soft" />
          </div>
          <div className="h-[104px] rounded-2xl border border-line bg-card" />
        </div>
      </div>
    </div>
  );
}

export function ProductPage({ product }: { product: Product }) {
  return (
    <Suspense fallback={<ProductSkeleton product={product} />}>
      <ProductDetail product={product} />
    </Suspense>
  );
}
