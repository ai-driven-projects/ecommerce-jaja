'use client';

import Link from 'next/link';
import { Badge } from '@/shared/components/ui/badge';
import { EtaBadge } from '@/shared/components/store/eta-badge.component';
import { Price } from '@/shared/components/store/price.component';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { AddToCartControl } from '@/shared/components/store/quantity-stepper.component';
import type { StoreProduct } from '@/shared/components/store/store.types';
import { cn } from '@/shared/lib/class-name.util';

type ProductCardProps = {
  product: StoreProduct;
  href: string;
  /** ETA do bairro atual; sem valor o selo não aparece. */
  etaMinutes?: number | null;
  quantity?: number;
  /** Sem esta ação o card não exibe o "+". */
  onChangeQuantity?: (quantity: number) => void;
  /** Área de imagem maior (usado nas ofertas). */
  size?: 'md' | 'lg';
  className?: string;
};

/** Desconto do produto: o da API; sem ele (catálogo local), calculado pelo preço "De:". */
function discountOf(product: StoreProduct): number | null {
  if (product.discountPercent !== undefined) return product.discountPercent;
  if (!product.oldPriceCents || product.oldPriceCents <= product.priceCents) return null;
  return Math.round((1 - product.priceCents / product.oldPriceCents) * 100);
}

// Cartão branco com raio 18: em hover sobe 2px e ganha sombra. A área de
// imagem e o nome levam ao produto; o "+" (quando há ação) adiciona ao
// carrinho. Um único selo na imagem: desconto > Destaque > ETA.
export function ProductCard({
  product,
  href,
  etaMinutes,
  quantity = 0,
  onChangeQuantity,
  size = 'md',
  className,
}: ProductCardProps) {
  const off = discountOf(product);

  return (
    <article
      className={cn(
        'flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-3 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-card',
        className,
      )}
    >
      <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
        <ProductArt
          emoji={product.emoji}
          category={product.category}
          imageUrl={product.imageUrl}
          alt={product.name}
          size={size}
        >
          {off ? (
            <Badge variant="solid" className="absolute left-2 top-2 px-2.5 py-[3px] text-[11.5px]">
              −{off}%
            </Badge>
          ) : product.badge === 'featured' ? (
            <Badge variant="brand" className="absolute left-2 top-2 bg-card px-2.5 py-[3px] text-[11.5px] shadow-badge">
              Destaque
            </Badge>
          ) : typeof etaMinutes === 'number' ? (
            <EtaBadge minutes={etaMinutes} className="absolute left-2 top-2" />
          ) : null}
        </ProductArt>
      </Link>

      <div className="flex-1">
        <Link
          href={href}
          title={product.name}
          className="line-clamp-3 text-sm font-bold leading-[1.35] text-ink transition-colors duration-150 hover:text-brand"
        >
          {product.name}
        </Link>
        <p className="mt-0.5 text-[12.5px] text-muted-ink">{product.unit}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <Price cents={product.priceCents} oldCents={product.oldPriceCents} className="whitespace-nowrap text-base" />
        {onChangeQuantity ? (
          <AddToCartControl quantity={quantity} onChange={onChangeQuantity} itemName={product.name} />
        ) : null}
      </div>
    </article>
  );
}
