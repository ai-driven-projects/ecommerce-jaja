'use client';

import { useRouter } from 'next/navigation';
import { ONGOING_ORDERS_COUNT, MAIN_HUB } from '@/modules/admin/data/dashboard.mock';
import { AdminGuard } from '@/modules/auth/components/admin-guard.component';
import { useAuth } from '@/modules/auth/data/auth.context';
import { ShellProvider } from '@/shared/context/shell.context';
import { ADMIN_LOGIN_ROUTE, ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { AppSidebarNavigation } from '@/shared/navigation/app-sidebar-navigation.component';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { AdminShell } from '@/shared/template/admin-shell.component';

/** Área administrativa: guard de sessão + shell com a barra escura e o usuário logado. */
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    signOut();
    router.replace(ADMIN_LOGIN_ROUTE);
  };

  return (
    <AdminGuard>
      <ShellProvider defaultOpen>
        <AdminShell
          sidebar={<AppSidebarNavigation badges={{ orders: ONGOING_ORDERS_COUNT }} />}
          logoHref={ADMIN_ROUTE}
          storeHref={STOREFRONT_ROUTE}
          userName={user?.name}
          userEmail={user?.email}
          userSubtitle={MAIN_HUB}
          userAvatarUrl={user?.avatarUrl}
          onLogout={handleLogout}
        >
          {children}
        </AdminShell>
      </ShellProvider>
    </AdminGuard>
  );
}
