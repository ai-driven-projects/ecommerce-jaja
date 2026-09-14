'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { Price } from '@/shared/components/store/price.component';
import { QuantityStepper } from '@/shared/components/store/quantity-stepper.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/class-name.util';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { withQuery } from '@/shared/navigation/with-query.util';
import { DELIVERY_FEE_CENTS, FREE_DELIVERY_THRESHOLD_CENTS } from '@/shared/util/cart.util';
import { formatPrice } from '@/shared/util/price.util';
import type { StorefrontProductDetail } from '../data/storefront.api';
import { buildStorefrontHref, hasCatalogFilters, storefrontBaseParams } from '../data/storefront-query.util';
import { useStorefront } from '../data/use-storefront.hook';
import { useStorefrontProducts } from '../data/use-storefront-products.hook';
import { ProductGallery } from './product-gallery.component';
import { StorefrontProductGrid } from './storefront-product-grid.component';

type ProductDetailProps = {
  product: StorefrontProductDetail;
};

/** Descrição maior que isto começa recolhida (~8 linhas) com "Ler mais". */
const DESCRIPTION_COLLAPSE_LENGTH = 600;
const RELATED_LIMIT = 4;

function Truck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M21 8v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8" />
      <path d="M1 4h22v4H1z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function ProductDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const collapsible = text.length > DESCRIPTION_COLLAPSE_LENGTH;

  return (
    <section className="mb-5">
      <h2 className="mb-2 font-display text-[17px] font-bold">Sobre o produto</h2>
      <p
        id={id}
        className={cn('whitespace-pre-line text-[14.5px] leading-[1.65] text-ink-soft', collapsible && !expanded && 'line-clamp-8')}
      >
        {text}
      </p>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1.5 text-sm font-bold text-brand transition-colors duration-150 hover:text-brand-link"
        >
          {expanded ? 'Ler menos' : 'Ler mais'}
        </button>
      ) : null}
    </section>
  );
}

/** "Mais de <categoria>": até 4 outros produtos da categoria do produto; some sem itens. */
function RelatedProducts({ product }: ProductDetailProps) {
  const category = product.categories.at(-1);
  const related = useStorefrontProducts({ categorySlug: category?.slug, pageSize: RELATED_LIMIT + 1, sort: 'featured' });
  const items = related.items.filter((item) => item.id !== product.id).slice(0, RELATED_LIMIT);

  if (!category || items.length === 0) return null;

  return (
    <section className="mt-11">
      <h2 className="mb-3.5 font-display text-[22px] font-extrabold tracking-[-0.5px]">Mais de {category.name}</h2>
      <StorefrontProductGrid products={items} />
    </section>
  );
}

/**
 * Detalhe do produto do catálogo: trilha de categorias (e "← Voltar aos
 * resultados" quando a URL tem busca ou filtros), galeria, selos, marca, nome,
 * unidade, código, preço, quantidade com "Adicionar" (ainda sem carrinho: só o
 * aviso), cartão de entrega, descrição, ficha e "Mais de <categoria>".
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const storefront = useStorefront();
  const [quantity, setQuantity] = useState(1);

  const eta = storefront.etaMinutes;
  const base = storefrontBaseParams(storefront.params);
  const rootSlug = product.categories[0]?.slug ?? '';
  const showBackToResults = Boolean(storefront.params.search) || hasCatalogFilters(storefront.params);
  const hasDiscount = Boolean(product.discountPercent);

  const specs: Array<[string, string]> = [];
  if (product.brand) specs.push(['Marca', product.brand.name]);
  if (product.categories.length > 0) specs.push(['Categoria', product.categories.map((category) => category.name).join(' / ')]);
  if (product.sku) specs.push(['Código', product.sku]);
  specs.push(['Unidade', product.unit]);

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-[22px] sm:px-6">
      <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <nav aria-label="Caminho" className="min-w-0 text-[13.5px] text-muted-ink">
          <ol className="flex flex-wrap items-baseline gap-y-1">
            <li>
              <Link href={buildStorefrontHref(base)} className="transition-colors duration-150 hover:text-brand">
                Início
              </Link>
            </li>
            {product.categories.map((category) => (
              <li key={category.slug}>
                <span className="mx-1.5" aria-hidden="true">
                  /
                </span>
                <Link
                  href={buildStorefrontHref(base, { category: category.slug })}
                  className="transition-colors duration-150 hover:text-brand"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li className="min-w-0">
              <span className="mx-1.5" aria-hidden="true">
                /
              </span>
              <span aria-current="page" className="font-bold text-ink">
                {product.name}
              </span>
            </li>
          </ol>
        </nav>
        {showBackToResults ? (
          <Link
            href={withQuery(STOREFRONT_ROUTE, storefront.query)}
            className="shrink-0 text-[13.5px] font-bold text-brand transition-colors duration-150 hover:text-brand-link"
          >
            ← Voltar aos resultados
          </Link>
        ) : null}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <ProductGallery key={product.slug} images={product.images} name={product.name} category={rootSlug} etaMinutes={eta} />

        <div className="min-w-0">
          {product.isFeatured || hasDiscount ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {product.isFeatured ? <Badge variant="brand">Em destaque</Badge> : null}
              {hasDiscount ? <Badge variant="solid">−{product.discountPercent}%</Badge> : null}
            </div>
          ) : null}

          {product.brand ? (
            <p className="mb-1 text-[13.5px]">
              <Link
                href={buildStorefrontHref(base, { brands: [product.brand.slug] })}
                className="font-bold text-brand transition-colors duration-150 hover:text-brand-link"
              >
                {product.brand.name}
              </Link>
            </p>
          ) : null}

          <h1 className="mb-1.5 break-words font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.8px] sm:text-[32px]">
            {product.name}
          </h1>
          <p className="mb-[18px] text-[14.5px] text-muted-ink">
            {product.unit}
            {product.sku ? <> · Cód. {product.sku}</> : null}
          </p>

          <div className="mb-5 flex flex-wrap items-baseline gap-2.5">
            <Price
              cents={product.priceCents}
              oldCents={product.listPriceCents}
              className="font-display text-[34px] tracking-[-0.5px] [&>s]:text-base"
            />
            {quantity > 1 ? (
              <span className="text-sm text-muted-ink">
                {quantity} un por <strong className="text-brand">{formatPrice(product.priceCents * quantity)}</strong>
              </span>
            ) : null}
          </div>

          <div className="mb-3.5 flex flex-wrap items-center gap-3">
            <QuantityStepper size="lg" quantity={quantity} onChange={setQuantity} min={1} itemName={product.name} />
            <Button
              size="xl"
              onClick={() => toast('Carrinho chega já já.')}
              disabled={!storefront.served}
              className="min-w-[200px] flex-1"
            >
              Adicionar · {formatPrice(product.priceCents * quantity)}
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

          {product.description ? <ProductDescription text={product.description} /> : null}

          <dl className="grid gap-2 text-[13.5px] sm:grid-cols-2">
            {specs.map(([label, value]) => (
              <div key={label} className={cn('rounded-[10px] bg-surface px-[13px] py-[9px]', label === 'Categoria' && 'sm:col-span-2')}>
                <dt className="inline text-muted-ink">{label}</dt>
                <span aria-hidden="true"> · </span>
                <dd className="inline font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <RelatedProducts product={product} />
    </main>
  );
}
