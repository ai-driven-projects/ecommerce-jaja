'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ADMIN_LOGIN_ROUTE } from '@/shared/navigation/admin-routes';
import { useAuth } from '../data/auth.context';

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const ADMIN_RESTRICTED_MESSAGE = 'Acesso restrito a administradores';

/**
 * Protege a árvore administrativa. O servidor não conhece o cookie, então o
 * guard renderiza `null` no HTML inicial e decide no cliente com o estado que
 * o `AuthProvider` já leu do cookie de forma síncrona. `useSyncExternalStore`
 * entrega `false` durante a hidratação e `true` logo depois, sem divergência
 * de markup e sem passar por um render "sem sessão" no reload.
 *
 * A sessão nunca é descartada aqui: um cliente da loja que não é administrador
 * apenas é avisado e levado a `/admin/login`, continuando logado na vitrine.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuth();
  const isHydrated = useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
  const canRender = isHydrated && isAuthenticated && isAdmin;

  useEffect(() => {
    if (!isHydrated || canRender) return;

    if (isAuthenticated && !isAdmin) {
      toast.error(ADMIN_RESTRICTED_MESSAGE);
    }

    router.replace(ADMIN_LOGIN_ROUTE);
  }, [canRender, isAdmin, isAuthenticated, isHydrated, router]);

  if (!canRender) return null;

  return <>{children}</>;
}
