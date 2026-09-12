'use client';

import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { PrivateAppShell } from '@/modules/auth/components/private-app-shell.component';
import { SidebarMenu, type SidebarMenuItem } from '@/shared/components/ui/sidebar-menu.component';

const customersMenuItems: SidebarMenuItem[] = [
  {
    id: 'overview',
    label: 'Visão Geral Clientes',
    href: '/customers',
    icon: LayoutDashboard,
    match: 'exact',
  },
];

function CustomersSidebarMenu() {
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
          id: 'customers',
          label: 'Clientes',
          items: customersMenuItems,
        },
      ]}
    />
  );
}

export default function CustomersModuleLayout({ children }: { children: React.ReactNode }) {
  return <PrivateAppShell sidebar={<CustomersSidebarMenu />}>{children}</PrivateAppShell>;
}
