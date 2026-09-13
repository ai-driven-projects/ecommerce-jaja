'use client';

import { CategoryChips } from '@/shared/components/store/category-chips.component';
import { ProductGrid } from '@/shared/components/store/product-grid.component';
import { SectionHeading } from '@/shared/components/store/section-heading.component';
import type { StoreProduct } from '@/shared/components/store/store.types';
import { productRoute } from '@/shared/navigation/storefront-routes';
import { useCart } from '../data/cart.context';
import { CATEGORY_OPTIONS, COURIERS_ONLINE, PRODUCTS, categoryLabel } from '../data/storefront.mock';
import { CATEGORY_ALL, type Product } from '../data/storefront.types';
import { useStorefront } from '../data/use-storefront.hook';
import { StorefrontHero } from './storefront-hero.component';

const TOP_ANCHOR = 'mais-pedidos';

type SectionProps = {
  id?: string;
  title: string;
  products: Product[];
  etaMinutes: number | null;
  query: string;
  minCardWidth?: 180 | 220;
  cardSize?: 'md' | 'lg';
  onSeeAll?: { label: string; href: string };
};

function ProductSection({ id, title, products, etaMinutes, query, minCardWidth, cardSize, onSeeAll }: SectionProps) {
  const cart = useCart();

  if (products.length === 0) return null;

  return (
    <section id={id} className="scroll-mt-28">
      <SectionHeading title={title} action={onSeeAll} />
      <ProductGrid
        products={products}
        etaMinutes={etaMinutes}
        minCardWidth={minCardWidth}
        cardSize={cardSize}
        getHref={(product: StoreProduct) => productRoute(product.slug, query)}
        getQuantity={(product) => cart.getQuantity(product.slug)}
        onChangeQuantity={(product, quantity) => cart.setQuantity(product.slug, quantity)}
      />
    </section>
  );
}

// Estado vazio: bairro fora da área de cobertura, com os bairros atendidos
// clicáveis, agrupados por loja.
function NotServed({ stores, onPick }: { stores: [string, string[]][]; onPick: (neighborhood: string) => void }) {
  return (
    <section className="rounded-4xl border border-line bg-card px-6 py-10 sm:px-11 sm:py-12">
      <span className="text-[44px] leading-none" aria-hidden="true">
        🚲
      </span>
      <h1 className="mt-4 font-display text-[clamp(28px,5vw,44px)] font-extrabold leading-[1.1] tracking-[-1px]">
        Ainda não chegamos aí.
        <br />
        <span className="text-brand">Já já.</span>
      </h1>
      <p className="mb-5 mt-3 text-muted-ink">Por enquanto entregamos nestes bairros:</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
        {stores.map(([store, neighborhoods]) => (
          <div key={store}>
            <h2 className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.06em] text-muted-ink">{store}</h2>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((neighborhood) => (
                <button
                  key={neighborhood}
                  type="button"
                  onClick={() => onPick(neighborhood)}
                  className="rounded-pill border border-line bg-card px-[15px] py-2 text-[13.5px] font-bold transition-colors duration-150 hover:border-brand hover:bg-brand-soft hover:text-brand"
                >
                  {neighborhood}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Conteúdo da vitrine. O cabeçalho, o carrinho e o rodapé vêm do `StorefrontShell`
// aplicado pelo layout do grupo público.
export function Storefront() {
  const storefront = useStorefront();
  const { category, etaMinutes, query } = storefront;
  const isAll = category === CATEGORY_ALL;

  const top = PRODUCTS.filter((product) => product.highlight === 'top');
  const restock = PRODUCTS.filter((product) => product.highlight === 'restock');
  const offers = PRODUCTS.filter((product) => product.oldPriceCents);

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-[34px] px-4 pb-10 pt-3 sm:px-6">
      <CategoryChips
        categories={CATEGORY_OPTIONS.map((option) => ({ id: option.id, label: option.label, emoji: option.emoji }))}
        active={category}
        onChange={storefront.setCategory}
        className="-mx-4 px-4 sm:-mx-6 sm:px-6"
      />

      {!storefront.served ? (
        <NotServed stores={storefront.stores} onPick={storefront.setNeighborhood} />
      ) : isAll ? (
        <>
          <StorefrontHero neighborhood={storefront.neighborhood} couriersOnline={COURIERS_ONLINE} ctaHref={`#${TOP_ANCHOR}`} />
          <ProductSection id={TOP_ANCHOR} title="Mais pedidos nos escritórios" products={top} etaMinutes={etaMinutes} query={query} />
          <ProductSection title="Repor agora" products={restock} etaMinutes={etaMinutes} query={query} />
          <ProductSection
            title="Ofertas da semana"
            products={offers}
            etaMinutes={etaMinutes}
            query={query}
            minCardWidth={220}
            cardSize="lg"
          />
        </>
      ) : (
        <ProductSection
          title={categoryLabel(category as Product['category'])}
          products={storefront.visibleProducts}
          etaMinutes={etaMinutes}
          query={query}
        />
      )}
    </main>
  );
}
