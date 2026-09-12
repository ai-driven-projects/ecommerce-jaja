'use client';

import { usePathname } from 'next/navigation';
import { SidebarMenu } from '@/shared/components/ui/sidebar-menu.component';
import { getAppModuleNavigationEntries, resolveAppSidebarState } from '@/shared/navigation/app-modules';

/**
 * Componente de navegação lateral do app.
 * Usado no layout do grupo (private).
 *
 * Se o app tiver perfis (ex: admin), passe isAdmin como prop e
 * propague para getAppModuleNavigationEntries(isAdmin) e resolveAppSidebarState(pathname, isAdmin).
 */
export function AppSidebarNavigation() {
  const pathname = usePathname();
  const sidebarState = resolveAppSidebarState(pathname);

  return (
    <SidebarMenu
      mainItem={sidebarState.mainItem}
      sections={sidebarState.sections}
      moduleNavigation={{
        activeModuleId: sidebarState.activeModuleId,
        items: getAppModuleNavigationEntries(),
      }}
    />
  );
}
