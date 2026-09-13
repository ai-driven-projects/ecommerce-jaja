'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { AuthForm, type AuthMode } from '../components/auth-form.component';
import { useAuth } from '../data/auth.context';
import type { AuthUser } from '../data/auth.types';
import { firstNameOf } from '../data/first-name.util';

/**
 * Destino de retorno seguro: só caminhos relativos iniciados por `/` (e não por
 * `//`, que o navegador trataria como outro host). Qualquer outro valor vira `/`.
 */
export function resolveReturnTo(value: string | null | undefined): string {
  if (typeof value !== 'string') return STOREFRONT_ROUTE;
  if (!value.startsWith('/') || value.startsWith('//')) return STOREFRONT_ROUTE;
  return value;
}

export function welcomeMessage(user: AuthUser, mode: AuthMode): string {
  const name = firstNameOf(user.name);
  return mode === 'register' ? `Conta criada. Bem-vindo, ${name}` : `Bem-vindo, ${name}`;
}

// Lê `voltar` da query (exige Suspense) e aplica o retorno à origem.
function StorefrontLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const returnTo = resolveReturnTo(searchParams.get('voltar'));

  useEffect(() => {
    if (isAuthenticated) router.replace(returnTo);
  }, [isAuthenticated, returnTo, router]);

  const handleSignedIn = (user: AuthUser, mode: AuthMode) => {
    toast.success(welcomeMessage(user, mode));
    router.replace(returnTo);
  };

  return (
    <div className="rounded-3xl border border-line bg-card p-6">
      <AuthForm onSignedIn={handleSignedIn} />
    </div>
  );
}

// Estrutura estática do formulário (sem shimmer) enquanto a query string é lida.
function StorefrontLoginSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-card p-6" aria-hidden="true">
      <div className="h-11 rounded-pill bg-surface" />
      <div className="mt-5 flex flex-col gap-4">
        <div className="h-[62px] rounded-xl bg-surface" />
        <div className="h-[62px] rounded-xl bg-surface" />
        <div className="mt-1 h-12 rounded-pill bg-brand-soft" />
      </div>
    </div>
  );
}

const PERKS = ['Entrega de bike em minutos', 'Endereço e andar salvos', 'Histórico de pedidos do escritório'];

/**
 * Página pública `/entrar` da loja: título display e as abas "Entrar" /
 * "Criar conta" dentro do shell da vitrine. Sucesso agradece e volta para
 * `voltar`; quem já tem sessão vai direto para lá.
 */
export function StorefrontLoginPage() {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-10 sm:px-6 lg:py-14">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="max-w-[480px]">
          <span className="mb-4 inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3.5 py-1.5 text-[13px] font-bold text-brand">
            <BikeIcon className="size-[15px]" strokeWidth={2} />
            Conta do escritório
          </span>
          <h1 className="font-display text-[32px] font-extrabold leading-[1.1] tracking-[-1px] sm:text-[40px]">
            Entre ou crie
            <br />
            sua conta<span className="text-brand">.</span>
          </h1>
          <p className="mt-3 text-base leading-[1.55] text-muted-ink">
            Uma conta para todo o escritório pedir o que falta e acompanhar a bike chegando.
          </p>
          <ul className="mt-6 flex flex-col gap-2.5 text-sm font-bold">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-xs text-success" aria-hidden="true">
                  ✓
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <Suspense fallback={<StorefrontLoginSkeleton />}>
          <StorefrontLoginContent />
        </Suspense>
      </div>
    </main>
  );
}
