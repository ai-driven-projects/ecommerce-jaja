'use client';

import { isStorefrontHome } from '../data/storefront-query.util';
import { useStorefront } from '../data/use-storefront.hook';
import { StorefrontCategoryNav } from './storefront-category-nav.component';
import { StorefrontHome } from './storefront-home.component';
import { StorefrontListing } from './storefront-listing.component';

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
// aplicado pelo layout do grupo público. Sem busca, filtros e categoria, a
// página inicial; com qualquer um deles, a listagem. Bairro não atendido mostra
// o estado vazio em qualquer modo.
export function Storefront() {
  const storefront = useStorefront();

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-[34px] px-4 pb-10 pt-3 sm:px-6">
      <StorefrontCategoryNav />

      {!storefront.served ? (
        <NotServed stores={storefront.stores} onPick={storefront.setNeighborhood} />
      ) : isStorefrontHome(storefront.params) ? (
        <StorefrontHome />
      ) : (
        <StorefrontListing />
      )}
    </main>
  );
}
