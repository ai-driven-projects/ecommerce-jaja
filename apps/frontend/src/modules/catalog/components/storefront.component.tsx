'use client';

import { isStorefrontHome } from '../data/storefront-query.util';
import { useStorefront } from '../data/use-storefront.hook';
import { StorefrontCategoryNav } from './storefront-category-nav.component';
import { StorefrontHome } from './storefront-home.component';
import { StorefrontListing } from './storefront-listing.component';

// Conteúdo da vitrine. O cabeçalho, o carrinho e o rodapé vêm do `StorefrontShell`
// aplicado pelo layout do grupo público. Sem busca, filtros e categoria, a
// página inicial; com qualquer um deles, a listagem. O catálogo é único: a loja
// escolhida no cabeçalho não muda os produtos nem os preços, e não existe
// estado de área não atendida (a cobertura por raio chega depois).
export function Storefront() {
  const storefront = useStorefront();

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-[34px] px-4 pb-10 pt-3 sm:px-6">
      <StorefrontCategoryNav />

      {isStorefrontHome(storefront.params) ? <StorefrontHome /> : <StorefrontListing />}
    </main>
  );
}
