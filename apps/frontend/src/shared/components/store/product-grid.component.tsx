'use client';

import { ProductCard } from '@/shared/components/store/product-card.component';
import type { StoreProduct } from '@/shared/components/store/store.types';
import { cn } from '@/shared/lib/class-name.util';

type ProductGridProps = {
  products: StoreProduct[];
  /** Monta o link de cada card. Padrão: `/p/<slug>`. */
  getHref?: (product: StoreProduct) => string;
  etaMinutes?: number | null;
  getQuantity?: (product: StoreProduct) => number;
  /** Sem esta ação os cards não exibem o "+". */
  onChangeQuantity?: (product: StoreProduct, quantity: number) => void;
  /** Quantidade máxima por produto: o "+" do stepper fica indisponível ao atingi-la. */
  max?: number;
  /** Largura mínima dos cards (180 padrão; 220 nas ofertas). */
  minCardWidth?: 180 | 220;
  cardSize?: 'md' | 'lg';
  className?: string;
};

function defaultHref(product: StoreProduct) {
  return `/p/${encodeURIComponent(product.slug)}`;
}

// Grade fluida: cards de no mínimo 180px, com 14px entre eles.
export function ProductGrid({
  products,
  getHref = defaultHref,
  etaMinutes,
  getQuantity,
  onChangeQuantity,
  max,
  minCardWidth = 180,
  cardSize = 'md',
  className,
}: ProductGridProps) {
  return (
    <div
      className={cn(
        'grid gap-3.5',
        minCardWidth === 220
          ? 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))]'
          : 'grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]',
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          href={getHref(product)}
          etaMinutes={etaMinutes}
          size={cardSize}
          quantity={getQuantity?.(product) ?? 0}
          onChangeQuantity={onChangeQuantity ? (quantity) => onChangeQuantity(product, quantity) : undefined}
          max={max}
        />
      ))}
    </div>
  );
}
