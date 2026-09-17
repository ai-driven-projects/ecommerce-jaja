'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import type { CartLine } from '@/modules/orders/data/cart.api';
import { CartProvider, useCart } from '@/modules/orders/data/cart.context';
import { CART_ITEM_MAX_QUANTITY } from '@/modules/orders/data/cart.util';
import { useStorefrontStores } from '@/modules/stores/data/use-storefront-stores.hook';
import { AppLogo } from '@/shared/components/branding/app-logo.component';
import { CartDrawer } from '@/shared/components/store/cart-drawer.component';
import { STORE_PICKER_PLACEHOLDER } from '@/shared/components/store/store-picker.component';
import type { CartItem } from '@/shared/components/store/store.types';
import { StorefrontFooter } from '@/shared/components/store/storefront-footer.component';
import { CompactStorefrontHeader, StorefrontHeader } from '@/shared/components/store/storefront-header.component';
import { StorefrontLayout } from '@/shared/template/storefront-layout.component';
import { useHydrated } from '@/shared/hooks/use-hydrated.hook';
import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import {
  CHECKOUT_ROUTE,
  STOREFRONT_LOGIN_ROUTE,
  STOREFRONT_ROUTE,
  myAccountRoute,
  productRoute,
} from '@/shared/navigation/storefront-routes';
import { withQuery } from '@/shared/navigation/with-query.util';
import { StorefrontCatalogProvider } from '../data/storefront-catalog.context';
import { useStorefront } from '../data/use-storefront.hook';

const TRACKING_PATH_PATTERN = /^\/pedidos\/[^/]+\/acompanhar$/;

/** Linha do carrinho da API → linha exibida na gaveta. */
function toCartItem(line: CartLine): CartItem {
  return {
    productId: line.productId,
    slug: line.slug,
    name: line.name,
    unit: line.unit,
    category: line.rootCategorySlug,
    imageUrl: line.thumbUrl,
    priceCents: line.priceCents,
    quantity: line.quantity,
    lineTotalCents: line.lineTotalCents,
    isAvailable: line.isAvailable,
  };
}

// Cabeçalho + carrinho ligados ao estado da vitrine (loja e busca na URL) e à
// sessão do cliente. Fica em um componente próprio porque `useSearchParams`
// exige Suspense. A busca leva à vitrine com `q` e a loja em vigor, descartando
// os demais filtros, também a partir do detalhe do produto.
function ConnectedHeader() {
  const storefront = useStorefront();
  const cart = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, signOut } = useAuth();
  // A sessão vem do cookie e só o cliente a conhece: até hidratar, o cabeçalho
  // mostra "Entrar" nos dois lados para o markup não divergir.
  const hydrated = useHydrated();

  const search = searchParams.toString();
  const currentUrl = pathname + (search ? `?${search}` : '');
  // Na própria página de acesso o link não deve aninhar `voltar` dentro de `voltar`.
  const signInHref =
    pathname === STOREFRONT_LOGIN_ROUTE ? currentUrl : `${STOREFRONT_LOGIN_ROUTE}?voltar=${encodeURIComponent(currentUrl)}`;

  const handleSignOut = () => {
    signOut();
    toast.success('Até já já.');
  };

  // Fecha o carrinho antes de navegar: o shell persiste entre as rotas públicas.
  const handleCheckout = () => {
    cart.close();
    router.push(withQuery(CHECKOUT_ROUTE, storefront.query));
  };

  return (
    <>
      <StorefrontHeader
        store={storefront.store}
        stores={storefront.stores}
        cartCount={hydrated ? cart.count : 0}
        onStoreChange={storefront.setStore}
        onOpenCart={cart.open}
        userName={hydrated ? (user?.name ?? null) : null}
        userEmail={hydrated ? (user?.email ?? null) : null}
        myAccountHref={myAccountRoute(storefront.query)}
        isAdmin={hydrated && isAdmin}
        adminHref={ADMIN_ROUTE}
        signInHref={signInHref}
        onSignOut={handleSignOut}
        searchValue={storefront.params.search ?? ''}
        onSearch={storefront.searchProducts}
      />
      <CartDrawer
        open={cart.isOpen}
        onClose={cart.close}
        items={cart.lines.map(toCartItem)}
        totals={cart.detail}
        loading={cart.loading}
        busy={cart.isSyncing}
        hasUnavailableItems={cart.hasUnavailableItems}
        maxQuantity={CART_ITEM_MAX_QUANTITY}
        getHref={(item) => productRoute(item.slug, storefront.query)}
        onChangeQuantity={cart.setQuantity}
        onRemove={cart.remove}
        onCheckout={handleCheckout}
      />
    </>
  );
}

// Estrutura estática do cabeçalho (sem shimmer) enquanto a query string é lida.
function HeaderSkeleton() {
  return (
    <div className="border-b border-line bg-card" aria-hidden="true">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3.5 sm:px-6">
        <AppLogo size="lg" />
        <span className="rounded-pill border border-line bg-surface px-4 py-[9px] text-sm text-placeholder">
          {STORE_PICKER_PLACEHOLDER}
        </span>
        <span className="hidden h-[42px] flex-1 rounded-pill border border-line bg-surface md:block" />
        <span className="ml-auto h-10 w-[104px] rounded-pill bg-brand-soft" />
      </div>
    </div>
  );
}

/** Cabeçalho compacto do checkout e do acompanhamento, sem seletor de lojas, busca nem carrinho. */
function CompactHeader({ pathname }: { pathname: string }) {
  if (pathname === CHECKOUT_ROUTE) {
    return (
      <CompactStorefrontHeader
        aside={
          <span className="flex items-center gap-2 text-[13.5px] font-extrabold text-success">
            <Lock className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Checkout seguro
          </span>
        }
      />
    );
  }

  return (
    <CompactStorefrontHeader
      aside={
        <Link href={STOREFRONT_ROUTE} className="text-[13.5px] font-bold text-muted-ink transition-colors duration-150 hover:text-brand">
          Voltar para a loja →
        </Link>
      }
    />
  );
}

function ShellBody({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { stores } = useStorefrontStores();
  const isCompact = pathname === CHECKOUT_ROUTE || TRACKING_PATH_PATTERN.test(pathname);

  return (
    <StorefrontLayout
      header={
        isCompact ? (
          <CompactHeader pathname={pathname} />
        ) : (
          <Suspense fallback={<HeaderSkeleton />}>
            <ConnectedHeader />
          </Suspense>
        )
      }
      footer={<StorefrontFooter stores={stores.map((store) => store.name)} />}
    >
      {children}
    </StorefrontLayout>
  );
}

/**
 * Shell público da loja: carrinho, árvore de categorias, cabeçalho e rodapé
 * compartilhados em todas as páginas públicas. Checkout e acompanhamento usam
 * o cabeçalho compacto.
 */
export function StorefrontShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <StorefrontCatalogProvider>
        <ShellBody>{children}</ShellBody>
      </StorefrontCatalogProvider>
    </CartProvider>
  );
}
