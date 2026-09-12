'use client';

import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { PrivateAppShell } from '@/modules/auth/components/private-app-shell.component';
import { SidebarMenu, type SidebarMenuItem } from '@/shared/components/ui/sidebar-menu.component';

const storesMenuItems: SidebarMenuItem[] = [
  {
    id: 'overview',
    label: 'Visão Geral Lojas',
    href: '/stores',
    icon: LayoutDashboard,
    match: 'exact',
  },
];

function StoresSidebarMenu() {
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
          id: 'stores',
          label: 'Lojas',
          items: storesMenuItems,
        },
      ]}
    />
  );
}

export default function StoresModuleLayout({ children }: { children: React.ReactNode }) {
  return <PrivateAppShell sidebar={<StoresSidebarMenu />}>{children}</PrivateAppShell>;
}
