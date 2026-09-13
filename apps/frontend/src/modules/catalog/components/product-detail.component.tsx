'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { EtaBadge } from '@/shared/components/store/eta-badge.component';
import { Price } from '@/shared/components/store/price.component';
import { ProductArt, categoryEmoji, categoryTintClass } from '@/shared/components/store/product-art.component';
import { ProductGrid } from '@/shared/components/store/product-grid.component';
import { QuantityStepper } from '@/shared/components/store/quantity-stepper.component';
import { productRoute } from '@/shared/navigation/storefront-routes';
import { cn } from '@/shared/lib/class-name.util';
import { FREE_DELIVERY_THRESHOLD_CENTS, DELIVERY_FEE_CENTS } from '@/shared/util/cart.util';
import { formatPrice } from '@/shared/util/price.util';
import { useCart } from '../data/cart.context';
import { categoryLabel, relatedProducts } from '../data/storefront.mock';
import type { Product } from '../data/storefront.types';
import { useStorefront } from '../data/use-storefront.hook';

type ProductDetailProps = {
  product: Product;
};

const LOW_STOCK_THRESHOLD = 10;

/** Link de volta à vitrine preservando `bairro`/`categoria`. */
function storefrontHref(neighborhood: string, category: string): string {
  return `/?${new URLSearchParams({ bairro: neighborhood, categoria: category })}`;
}

function Truck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" />
      <path d="M1 4h22v4H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

/** Página de detalhe: imagem à esquerda, informação e ação à direita, relacionados no rodapé. */
export function ProductDetail({ product }: ProductDetailProps) {
  const storefront = useStorefront();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeArt, setActiveArt] = useState(0);

  const arts = [product.emoji, '📦', categoryEmoji(product.category)];
  const related = relatedProducts(product);
  const isTop = product.highlight === 'top';
  const isLow = product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  const isOut = product.stock === 0;
  const eta = storefront.etaMinutes;

  const handleAdd = () => {
    cart.add(product.slug, quantity);
    toast.success(`${product.name} no carrinho`, { description: `${quantity} × ${formatPrice(product.priceCents)}` });
    cart.open();
  };

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-[22px] sm:px-6">
      <nav aria-label="Caminho" className="mb-[18px] text-[13.5px] text-muted-ink">
        <Link href={storefrontHref(storefront.neighborhood, storefront.category)} className="transition-colors duration-150 hover:text-brand">
          Início
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        <Link href={storefrontHref(storefront.neighborhood, product.category)} className="transition-colors duration-150 hover:text-brand">
          {categoryLabel(product.category)}
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        <span className="font-bold text-ink">{product.name}</span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Imagem */}
        <div className="flex flex-col gap-3">
          <ProductArt emoji={arts[activeArt]} category={product.category} size="xl" className="h-[280px] sm:h-[380px]">
            {eta !== null ? <EtaBadge minutes={eta} prefix="Chega em" className="absolute left-4 top-4 px-3.5 py-1.5 text-[13px]" /> : null}
          </ProductArt>
          <div className="flex gap-2.5" role="tablist" aria-label="Imagens do produto">
            {arts.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                role="tab"
                aria-selected={index === activeArt}
                aria-label={`Imagem ${index + 1}`}
                onClick={() => setActiveArt(index)}
                className={cn(
                  'flex size-[72px] items-center justify-center rounded-xl border-2 text-[30px] transition-colors duration-150',
                  index === activeArt ? `border-brand ${categoryTintClass(product.category)}` : 'border-transparent bg-surface hover:border-line',
                )}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Informação */}
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {isTop ? <Badge variant="brand">Mais pedido</Badge> : null}
            {product.oldPriceCents ? <Badge variant="solid">Oferta da semana</Badge> : null}
            {storefront.hub ? (
              isOut ? (
                <Badge variant="danger">Acabou no {storefront.hub}</Badge>
              ) : isLow ? (
                <Badge variant="warning">Últimas {product.stock} no {storefront.hub}</Badge>
              ) : (
                <Badge variant="success">Em estoque no {storefront.hub}</Badge>
              )
            ) : null}
          </div>

          <h1 className="mb-1.5 font-display text-[28px] font-extrabold leading-[1.15] tracking-[-0.8px] sm:text-[32px]">
            {product.name}
          </h1>
          <p className="mb-[18px] text-[14.5px] text-muted-ink">{product.unit}</p>

          <div className="mb-5 flex flex-wrap items-baseline gap-2.5">
            <Price
              cents={product.priceCents}
              oldCents={product.oldPriceCents}
              className="font-display text-[34px] tracking-[-0.5px] [&>s]:text-base"
            />
            {!product.oldPriceCents && quantity > 1 ? (
              <span className="text-sm text-muted-ink">
                {quantity} un por <strong className="text-brand">{formatPrice(product.priceCents * quantity)}</strong>
              </span>
            ) : null}
          </div>

          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            <QuantityStepper size="lg" quantity={quantity} onChange={setQuantity} min={1} itemName={product.name} />
            <Button size="xl" onClick={handleAdd} disabled={isOut || !storefront.served} className="min-w-[200px] flex-1">
              {isOut ? 'Avisar quando voltar' : `Adicionar · ${formatPrice(product.priceCents * quantity)}`}
            </Button>
          </div>

          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-card px-[18px] py-4">
            <div className="flex items-center gap-[11px]">
              <BikeIcon className="size-5 shrink-0 text-success" strokeWidth={2} />
              <div>
                <strong className="text-sm">
                  {eta !== null ? `Entrega de bike em ~${eta} min` : 'Ainda não entregamos neste bairro'}
                </strong>
                <div className="text-[12.5px] text-muted-ink">
                  {eta !== null ? `Para ${storefront.neighborhood} · direto na sua recepção` : 'Escolha um bairro atendido no cabeçalho'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-[11px]">
              <Truck className="size-5 shrink-0 text-brand" />
              <div>
                <strong className="text-sm">Entrega grátis acima de {formatPrice(FREE_DELIVERY_THRESHOLD_CENTS)}</strong>
                <div className="text-[12.5px] text-muted-ink">Abaixo disso, taxa fixa de {formatPrice(DELIVERY_FEE_CENTS)}</div>
              </div>
            </div>
          </div>

          <h2 className="mb-2 font-display text-[17px] font-bold">Sobre o produto</h2>
          <p className="mb-3.5 text-[14.5px] leading-[1.65] text-ink-soft">{product.description}</p>
          <dl className="grid grid-cols-2 gap-2 text-[13.5px]">
            {product.specs.map(([label, value]) => (
              <div key={label} className="rounded-[10px] bg-surface px-[13px] py-[9px]">
                <dt className="inline text-muted-ink">{label}</dt>
                <span aria-hidden="true"> · </span>
                <dd className="inline font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-11">
          <h2 className="mb-3.5 font-display text-[22px] font-extrabold tracking-[-0.5px]">Quem pediu, também levou</h2>
          <ProductGrid
            products={related}
            etaMinutes={eta}
            getHref={(item) => productRoute(item.slug, storefront.query)}
            getQuantity={(item) => cart.getQuantity(item.slug)}
            onChangeQuantity={(item, nextQuantity) => cart.setQuantity(item.slug, nextQuantity)}
          />
        </section>
      ) : null}
    </main>
  );
}
