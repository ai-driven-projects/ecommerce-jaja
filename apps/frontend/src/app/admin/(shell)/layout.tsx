'use client';

import { ShellProvider } from '@/shared/context/shell.context';
import { AdminShell } from '@/shared/template/admin-shell.component';
import { AppSidebarNavigation } from '@/shared/navigation/app-sidebar-navigation.component';
import { RouteGuard } from '@/shared/auth/route-guard.component';

export default function PrivateGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <ShellProvider defaultOpen>
        <AdminShell sidebar={<AppSidebarNavigation />}>{children}</AdminShell>
      </ShellProvider>
    </RouteGuard>
  );
}
