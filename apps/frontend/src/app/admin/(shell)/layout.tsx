'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGuard } from '@/modules/auth/components/admin-guard.component';
import { useAuth } from '@/modules/auth/data/auth.context';
import { OrdersLiveProvider } from '@/modules/orders/data/orders-live.context';
import { useOrdersSummary } from '@/modules/orders/data/use-orders-summary.hook';
import { ShellProvider } from '@/shared/context/shell.context';
import { ADMIN_LOGIN_ROUTE, ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { AppSidebarNavigation } from '@/shared/navigation/app-sidebar-navigation.component';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { AdminShell } from '@/shared/template/admin-shell.component';

// Shell com o usuário logado e o menu lateral. O contador de "Pedidos" é o número
// de pedidos em andamento do resumo, ao vivo, lido uma vez aqui (a barra do
// desktop e a gaveta do mobile recebem o mesmo valor); oculto enquanto carrega e
// quando é 0.
function AdminShellWithOrders({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { summary } = useOrdersSummary();
  const inProgress = summary?.inProgress ?? 0;

  const handleLogout = () => {
    signOut();
    router.replace(ADMIN_LOGIN_ROUTE);
  };

  return (
    <AdminShell
      sidebar={<AppSidebarNavigation badges={inProgress > 0 ? { orders: inProgress } : {}} />}
      logoHref={ADMIN_ROUTE}
      storeHref={STOREFRONT_ROUTE}
      userName={user?.name}
      userEmail={user?.email}
      userAvatarUrl={user?.avatarUrl}
      onLogout={handleLogout}
    >
      {children}
    </AdminShell>
  );
}

/**
 * Área administrativa: guard de sessão + conexão ao vivo dos pedidos
 * (`OrdersLiveProvider`, uma por aba, compartilhada por menu, lista, dashboard e
 * painel) + shell com a barra escura e o usuário logado.
 */
export default function AdminShellLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <OrdersLiveProvider>
        <ShellProvider defaultOpen>
          <AdminShellWithOrders>{children}</AdminShellWithOrders>
        </ShellProvider>
      </OrdersLiveProvider>
    </AdminGuard>
  );
}
