'use client';

import { ProductGrid } from '@/shared/components/store/product-grid.component';
import type { StoreProduct } from '@/shared/components/store/store.types';
import { cn } from '@/shared/lib/class-name.util';
import { productRoute } from '@/shared/navigation/storefront-routes';
import type { StorefrontProductListItem } from '../data/storefront.api';
import { useStorefront } from '../data/use-storefront.hook';

/** Card da API → produto dos componentes de loja (tom e emoji de reserva pela raiz). */
export function toStoreProduct(item: StorefrontProductListItem): StoreProduct {
  return {
    slug: item.slug,
    name: item.name,
    category: item.rootCategorySlug,
    priceCents: item.priceCents,
    oldPriceCents: item.listPriceCents,
    unit: item.unit,
    imageUrl: item.thumbUrl,
    discountPercent: item.discountPercent,
    badge: item.isFeatured ? 'featured' : null,
  };
}

/** "1 produto" / "24 produtos". */
export function formatProductCount(count: number): string {
  return `${count} ${count === 1 ? 'produto' : 'produtos'}`;
}

type StorefrontProductGridProps = {
  products: StorefrontProductListItem[];
  minCardWidth?: 180 | 220;
  cardSize?: 'md' | 'lg';
  className?: string;
};

/**
 * Grade de produtos da loja, sem ação de carrinho (os cards não exibem o "+"):
 * o link de cada card leva ao detalhe preservando a query da vitrine.
 */
export function StorefrontProductGrid({ products, minCardWidth, cardSize, className }: StorefrontProductGridProps) {
  const storefront = useStorefront();

  return (
    <ProductGrid
      products={products.map(toStoreProduct)}
      etaMinutes={storefront.etaMinutes}
      minCardWidth={minCardWidth}
      cardSize={cardSize}
      className={className}
      getHref={(product) => productRoute(product.slug, storefront.query)}
    />
  );
}

type ProductGridSkeletonProps = {
  count?: number;
  minCardWidth?: 180 | 220;
  cardSize?: 'md' | 'lg';
};

/** Estrutura estática da grade (blocos creme, sem shimmer) enquanto a primeira página carrega. */
export function ProductGridSkeleton({ count = 6, minCardWidth = 180, cardSize = 'md' }: ProductGridSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid gap-3.5',
        minCardWidth === 220
          ? 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))]'
          : 'grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]',
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-3">
          <div className={cn('rounded-xl bg-surface', cardSize === 'lg' ? 'h-[130px]' : 'h-[120px]')} />
          <div className="h-4 w-3/4 rounded-md bg-surface" />
          <div className="h-3 w-1/2 rounded-md bg-surface" />
          <div className="mt-1 h-5 w-16 rounded-md bg-surface" />
        </div>
      ))}
    </div>
  );
}
