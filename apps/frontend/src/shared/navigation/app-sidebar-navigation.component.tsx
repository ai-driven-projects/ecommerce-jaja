'use client';

import { usePathname } from 'next/navigation';
import { SidebarMenu } from '@/shared/components/ui/sidebar-menu.component';
import { getAppModuleItemsWithBadges, resolveAppSidebarState, type AppModuleId } from '@/shared/navigation/app-modules';

type AppSidebarNavigationProps = {
  /** Contadores por módulo (ex.: `{ orders: 23 }`). */
  badges?: Partial<Record<AppModuleId, string | number>>;
};

/** Navegação lateral do admin, usada no layout do grupo `admin/(shell)`. */
export function AppSidebarNavigation({ badges = {} }: AppSidebarNavigationProps) {
  const pathname = usePathname();
  const sidebarState = resolveAppSidebarState(pathname);

  return <SidebarMenu items={getAppModuleItemsWithBadges(badges)} sections={sidebarState.sections} />;
}
