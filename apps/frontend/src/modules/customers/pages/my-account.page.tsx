'use client';

import { toast } from 'sonner';
import { AuthForm } from '@/modules/auth/components/auth-form.component';
import { useAuth } from '@/modules/auth/data/auth.context';
import { welcomeMessage } from '@/modules/auth/pages/storefront-login.page';
import { useStorefront } from '@/modules/catalog/data/use-storefront.hook';
import { useStorefrontStores } from '@/modules/stores/data/use-storefront-stores.hook';
import { useHydrated } from '@/shared/hooks/use-hydrated.hook';
import type { CustomerMapStore } from '../components/customer-address-map.component';
import { MY_ACCOUNT_CARD_CLASS, MyAccountForm } from '../components/my-account-form.component';
import { useMyCustomer } from '../data/use-my-customer.hook';

const PAGE_CLASS = 'mx-auto w-full max-w-[1080px] flex-1 px-4 pb-12 pt-[26px] sm:px-6';
const TITLE_CLASS = 'font-display text-[30px] font-extrabold leading-[1.15] tracking-[-0.8px]';

// Estrutura estática (sem shimmer) dos dois cartões enquanto o cadastro e as lojas carregam.
function MyAccountFormSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Carregando seus dados…</span>
      <div className={MY_ACCOUNT_CARD_CLASS} aria-hidden="true">
        <div className="mb-4 h-6 w-40 rounded-md bg-surface" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-11 rounded-xl bg-surface" />
          ))}
        </div>
      </div>
      <div className={MY_ACCOUNT_CARD_CLASS} aria-hidden="true">
        <div className="mb-4 h-6 w-52 rounded-md bg-surface" />
        <div className="h-9 w-56 rounded-pill bg-surface" />
        <div className="mt-3 h-[260px] rounded-2xl bg-surface" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-11 rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}

function MyAccountContent() {
  const { user, session } = useAuth();
  const storefront = useStorefront();
  const myCustomer = useMyCustomer();
  const storefrontStores = useStorefrontStores();

  // O mapa só é montado com as lojas carregadas, para não abrir na Paulista e pular para a loja.
  const loading = myCustomer.loading || storefrontStores.loading;
  // Todas as lojas ativas vão para o mapa (marcador + círculo do raio) e para a
  // lista abaixo dele; o slug da loja escolhida na vitrine só define a câmera e
  // o destaque.
  const stores: CustomerMapStore[] = storefrontStores.stores;

  if (!user || !session) return null;

  return (
    <>
      <h1 className={TITLE_CLASS}>Minha conta</h1>
      {!loading && myCustomer.customer === null ? (
        <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-soft">Preencha uma vez e seus pedidos saem mais rápido.</p>
      ) : null}

      <div className="mt-[22px]">
        {loading ? (
          <MyAccountFormSkeleton />
        ) : (
          <MyAccountForm
            key={session.token}
            customer={myCustomer.customer}
            defaults={{ city: storefront.city ?? '', state: storefront.state ?? '' }}
            save={myCustomer.save}
            user={user}
            token={session.token}
            stores={stores}
            storeSlug={storefront.storeSlug}
          />
        )}
      </div>
    </>
  );
}

// Sem sessão: pede para entrar ou criar conta na mesma URL. Ao autenticar, o
// contexto muda e os dados da conta aparecem sem redirecionar.
function MyAccountGate() {
  const { user, isAuthenticated } = useAuth();
  const hydrated = useHydrated();

  // A sessão só é conhecida no cliente: até hidratar, mantém a estrutura estática.
  if (!hydrated) return <MyAccountSkeletonContent />;

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className={`mb-2 ${TITLE_CLASS}`}>Entre para ver sua conta</h1>
        <p className="mb-6 text-sm text-muted-ink">Seus dados e o endereço de entrega ficam salvos para os próximos pedidos.</p>
        <div className="rounded-3xl border border-line bg-card p-6">
          <AuthForm onSignedIn={(signedUser, mode) => toast.success(welcomeMessage(signedUser, mode))} />
        </div>
      </div>
    );
  }

  return <MyAccountContent />;
}

function MyAccountSkeletonContent() {
  return (
    <>
      <div className="h-9 w-48 rounded-md bg-surface" aria-hidden="true" />
      <div className="mt-[22px]">
        <MyAccountFormSkeleton />
      </div>
    </>
  );
}

/** Estrutura estática (sem shimmer) da página enquanto a query string é lida. */
export function MyAccountPageSkeleton() {
  return (
    <main className={PAGE_CLASS}>
      <MyAccountSkeletonContent />
    </main>
  );
}

/**
 * Rota pública `/minha-conta`, com o cabeçalho completo da loja: sem sessão
 * pede para entrar ou criar conta na mesma URL; com sessão mostra os dados
 * pessoais (nome e email somente leitura, CPF e telefone) e o endereço de
 * entrega pelos campos e pelo mapa, que mostra todas as lojas ativas com o raio
 * de atendimento de cada uma e o centro na loja escolhida na vitrine
 * (`useStorefront().storeSlug` casado com `GET /storefront/stores`). Sem
 * cadastro de cliente, o formulário nasce com a cidade e a UF da loja escolhida,
 * quando conhecidas. Os dados salvos são os mesmos do checkout
 * (`useMyCustomer`). Nunca redireciona.
 */
export function MyAccountPage() {
  return (
    <main className={PAGE_CLASS}>
      <MyAccountGate />
    </main>
  );
}
