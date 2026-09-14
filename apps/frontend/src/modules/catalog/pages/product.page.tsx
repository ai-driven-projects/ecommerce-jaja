import { Suspense } from 'react';
import { ProductDetail } from '../components/product-detail.component';
import type { StorefrontProductDetail } from '../data/storefront.api';

// Estrutura estática do detalhe (sem shimmer) enquanto a query string é lida.
function ProductSkeleton({ product }: { product: StorefrontProductDetail }) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-[22px] text-placeholder sm:px-6" aria-hidden="true">
      <div className="mb-[18px] h-4 w-64 max-w-full rounded-md bg-surface" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="aspect-square w-full rounded-4xl bg-surface" />
          {product.images.length > 1 ? (
            <div className="flex gap-2.5 overflow-hidden">
              {product.images.map((image) => (
                <div key={`${image.order}-${image.thumbUrl}`} className="size-[72px] shrink-0 rounded-xl bg-surface" />
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <h1 className="mb-1.5 break-words font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.8px] sm:text-[32px]">
            {product.name}
          </h1>
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

export function ProductPage({ product }: { product: StorefrontProductDetail }) {
  return (
    <Suspense fallback={<ProductSkeleton product={product} />}>
      <ProductDetail product={product} />
    </Suspense>
  );
}
