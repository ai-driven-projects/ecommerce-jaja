'use client';

import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { PrivateAppShell } from '@/modules/auth/components/private-app-shell.component';
import { SidebarMenu, type SidebarMenuItem } from '@/shared/components/ui/sidebar-menu.component';

const catalogMenuItems: SidebarMenuItem[] = [
  {
    id: 'overview',
    label: 'Visão Geral Catálogo',
    href: '/catalog',
    icon: LayoutDashboard,
    match: 'exact',
  },
];

function CatalogSidebarMenu() {
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
          id: 'catalog',
          label: 'Catálogo',
          items: catalogMenuItems,
        },
      ]}
    />
  );
}

export default function CatalogModuleLayout({ children }: { children: React.ReactNode }) {
  return <PrivateAppShell sidebar={<CatalogSidebarMenu />}>{children}</PrivateAppShell>;
}
