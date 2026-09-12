'use client';

import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { PrivateAppShell } from '@/modules/auth/components/private-app-shell.component';
import { SidebarMenu, type SidebarMenuItem } from '@/shared/components/ui/sidebar-menu.component';

const authMenuItems: SidebarMenuItem[] = [
  {
    id: 'overview',
    label: 'Visão Geral Autenticação',
    href: '/auth',
    icon: LayoutDashboard,
    match: 'exact',
  },
];

function AuthSidebarMenu() {
  return (
    <SidebarMenu
      mainItem={{
        id: 'back',
        label: 'Voltar',
        href: '/dashboard',
        icon: ArrowLeft,
      }}
      sections={[
        {
          id: 'auth',
          label: 'Autenticação',
          items: authMenuItems,
        },
      ]}
    />
  );
}

export default function AuthModuleLayout({ children }: { children: React.ReactNode }) {
  return <PrivateAppShell sidebar={<AuthSidebarMenu />}>{children}</PrivateAppShell>;
}
