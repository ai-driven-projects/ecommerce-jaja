'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppLogo } from '@/shared/components/branding/app-logo.component';
import { Badge } from '@/shared/components/ui/badge';
import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { ADMIN_RESTRICTED_MESSAGE } from '../components/admin-guard.component';
import { AuthForm, type AuthMode } from '../components/auth-form.component';
import type { AuthUser } from '../data/auth.types';
import { firstNameOf } from '../data/first-name.util';

const RESTRICTED_MESSAGE_BY_MODE: Readonly<Record<AuthMode, string>> = {
  login: ADMIN_RESTRICTED_MESSAGE,
  register: 'Conta criada, mas o acesso à área administrativa é restrito a administradores',
};

/**
 * Tela de acesso administrativa (`/admin/login`): cartão centrado sobre papel
 * com logo, etiqueta "Operação" e as abas "Entrar" / "Criar conta". Aplica a
 * regra administrativa: só `admin === true` entra; o restante é avisado e
 * permanece aqui, mantendo a sessão (que continua válida na loja).
 */
export function LoginPage() {
  const router = useRouter();

  const handleSignedIn = (user: AuthUser, mode: AuthMode) => {
    if (user.admin !== true) {
      toast.error(RESTRICTED_MESSAGE_BY_MODE[mode]);
      return;
    }

    toast.success(`Bem-vindo, ${firstNameOf(user.name)}`);
    router.replace(ADMIN_ROUTE);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-10 text-ink">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <AppLogo size="lg" />
          <Badge variant="dark">Operação</Badge>
        </div>
        <h1 className="mb-1 font-display text-2xl font-extrabold tracking-[-0.5px]">Área administrativa</h1>
        <p className="mb-5 text-sm text-muted-ink">Acesso restrito à equipe das lojas.</p>
        <AuthForm onSignedIn={handleSignedIn} />
      </div>
      <Link href={STOREFRONT_ROUTE} className="mt-6 text-[13.5px] font-bold text-muted-ink transition-colors duration-150 hover:text-brand">
        ← Voltar para a loja
      </Link>
    </main>
  );
}
