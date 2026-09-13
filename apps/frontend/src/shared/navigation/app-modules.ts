import { Bike, LayoutDashboard, Package, Store, Tag, Users } from 'lucide-react';
import type { SidebarMenuItem, SidebarMenuSection } from '@/shared/components/ui/sidebar-menu.component';
import { ADMIN_ROUTE } from '@/shared/navigation/admin-routes';
import { CATALOG_ROUTE } from '@/shared/navigation/catalog-routes';
import { CUSTOMERS_ROUTE } from '@/shared/navigation/customers-routes';
import { ORDERS_ROUTE } from '@/shared/navigation/orders-routes';
import { STORES_ROUTE } from '@/shared/navigation/stores-routes';

// ── Tipos ──────────────────────────────────────────────────────────────────────

/** IDs dos módulos da navegação principal. */
export type AppModuleId = 'dashboard' | 'orders' | 'catalog' | 'couriers' | 'customers' | 'stores';

export type AppSidebarState = {
  activeModuleId: AppModuleId;
  sections: SidebarMenuSection[];
};

export type AppModuleNavigationEntry = {
  item: AppModuleItem;
  sections: SidebarMenuSection[];
};

export type AppModuleItem = SidebarMenuItem & { id: AppModuleId };

// ── Itens da barra ─────────────────────────────────────────────────────────────

const moduleItems: AppModuleItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: ADMIN_ROUTE, icon: LayoutDashboard, match: 'exact' },
  { id: 'orders', label: 'Pedidos', href: ORDERS_ROUTE, icon: Package },
  { id: 'catalog', label: 'Produtos & estoque', href: CATALOG_ROUTE, icon: Tag },
  { id: 'couriers', label: 'Entregadores', href: `${ADMIN_ROUTE}/couriers`, icon: Bike },
  { id: 'customers', label: 'Clientes', href: CUSTOMERS_ROUTE, icon: Users },
  { id: 'stores', label: 'Hubs & cobertura', href: STORES_ROUTE, icon: Store },
];

// ── Sub-itens por módulo (vazio enquanto cada módulo tem uma única tela) ──────

const sectionsByModuleId: Record<AppModuleId, SidebarMenuSection[]> = {
  dashboard: [],
  orders: [],
  catalog: [],
  couriers: [],
  customers: [],
  stores: [],
};

// ── Funções exportadas ─────────────────────────────────────────────────────────

export function getAppModuleItems(): AppModuleItem[] {
  return moduleItems;
}

/** Itens com contadores dinâmicos aplicados (ex.: pedidos em andamento). */
export function getAppModuleItemsWithBadges(badges: Partial<Record<AppModuleId, string | number>>): AppModuleItem[] {
  return moduleItems.map((item) => (badges[item.id] !== undefined ? { ...item, badge: badges[item.id] } : item));
}

export function getAppModuleNavigationEntries(): AppModuleNavigationEntry[] {
  return moduleItems.map((item) => ({ item, sections: sectionsByModuleId[item.id] }));
}

// O dashboard (`/admin`) é prefixo de todas as rotas administrativas, por isso
// só casa por igualdade exata; os demais módulos casam por rota ou sub-rota.
function isModuleActive(pathname: string, item: AppModuleItem): boolean {
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function resolveAppSidebarState(pathname: string): AppSidebarState {
  const active = moduleItems.find((item) => isModuleActive(pathname, item)) ?? moduleItems[0];
  return { activeModuleId: active.id, sections: sectionsByModuleId[active.id] };
}
