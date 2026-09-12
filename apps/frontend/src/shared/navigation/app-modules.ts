import { LayoutDashboard, Package, ShieldCheck, ShoppingCart, Store, Users } from 'lucide-react';
import type { SidebarMenuItem, SidebarMenuSection } from '@/shared/components/ui/sidebar-menu.component';
import { PRINCIPAL_ROUTE } from '@/shared/navigation/principal-routes';
import { AUTH_DASHBOARD_ROUTE } from '@/shared/navigation/auth-routes';
import { CATALOG_ROUTE } from '@/shared/navigation/catalog-routes';
import { CUSTOMERS_ROUTE } from '@/shared/navigation/customers-routes';
import { ORDERS_ROUTE } from '@/shared/navigation/orders-routes';
import { STORES_ROUTE } from '@/shared/navigation/stores-routes';

// ── Tipos ──────────────────────────────────────────────────────────────────────

/** IDs dos módulos de navegação principal (rail lateral). */
export type AppModuleId = 'principal' | 'catalog' | 'orders' | 'customers' | 'stores' | 'auth';

export type AppSidebarState = {
  activeModuleId: AppModuleId;
  mainItem?: SidebarMenuItem;
  sections: SidebarMenuSection[];
};

export type AppModuleNavigationEntry = {
  item: SidebarMenuItem;
  mainItem?: SidebarMenuItem;
  sections: SidebarMenuSection[];
};

type AppModuleItem = SidebarMenuItem & { id: AppModuleId };

// ── Itens do rail (módulos) ────────────────────────────────────────────────────

const moduleItems: AppModuleItem[] = [
  { id: 'principal', label: 'Principal', shortLabel: 'Principal', href: PRINCIPAL_ROUTE, icon: LayoutDashboard },
  { id: 'catalog', label: 'Catálogo', shortLabel: 'Catálogo', href: CATALOG_ROUTE, icon: Package },
  { id: 'orders', label: 'Pedidos', shortLabel: 'Pedidos', href: ORDERS_ROUTE, icon: ShoppingCart },
  { id: 'customers', label: 'Clientes', shortLabel: 'Clientes', href: CUSTOMERS_ROUTE, icon: Users },
  { id: 'stores', label: 'Lojas', shortLabel: 'Lojas', href: STORES_ROUTE, icon: Store },
  { id: 'auth', label: 'Autenticação', shortLabel: 'Auth', href: AUTH_DASHBOARD_ROUTE, icon: ShieldCheck },
];

// ── Estado do sidebar por módulo ───────────────────────────────────────────────

const sidebarStateByModuleId: Record<AppModuleId, AppSidebarState> = {
  principal: { activeModuleId: 'principal', sections: [] },
  catalog: {
    activeModuleId: 'catalog',
    sections: [
      {
        id: 'catalog',
        label: 'Catálogo',
        items: [
          { id: 'overview', label: 'Visão Geral Catálogo', href: CATALOG_ROUTE, icon: LayoutDashboard, match: 'exact' },
        ],
      },
    ],
  },
  orders: {
    activeModuleId: 'orders',
    sections: [
      {
        id: 'orders',
        label: 'Pedidos',
        items: [
          { id: 'overview', label: 'Visão Geral Pedidos', href: ORDERS_ROUTE, icon: LayoutDashboard, match: 'exact' },
        ],
      },
    ],
  },
  customers: {
    activeModuleId: 'customers',
    sections: [
      {
        id: 'customers',
        label: 'Clientes',
        items: [
          {
            id: 'overview',
            label: 'Visão Geral Clientes',
            href: CUSTOMERS_ROUTE,
            icon: LayoutDashboard,
            match: 'exact',
          },
        ],
      },
    ],
  },
  stores: {
    activeModuleId: 'stores',
    sections: [
      {
        id: 'stores',
        label: 'Lojas',
        items: [
          { id: 'overview', label: 'Visão Geral Lojas', href: STORES_ROUTE, icon: LayoutDashboard, match: 'exact' },
        ],
      },
    ],
  },
  auth: {
    activeModuleId: 'auth',
    sections: [
      {
        id: 'auth',
        label: 'Autenticação',
        items: [
          {
            id: 'overview',
            label: 'Visão Geral Autenticação',
            href: AUTH_DASHBOARD_ROUTE,
            icon: LayoutDashboard,
            match: 'exact',
          },
        ],
      },
    ],
  },
};

// ── Funções exportadas ─────────────────────────────────────────────────────────

export function getAppModuleItems(): AppModuleItem[] {
  return moduleItems;
}

export function getAppModuleNavigationEntries(): AppModuleNavigationEntry[] {
  return getAppModuleItems().map((item) => {
    const sidebarState = sidebarStateByModuleId[item.id];
    return { item, mainItem: sidebarState.mainItem, sections: sidebarState.sections };
  });
}

export function resolveAppSidebarState(pathname: string): AppSidebarState {
  const activeModuleItem = getAppModuleItems().find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (activeModuleItem) return sidebarStateByModuleId[activeModuleItem.id];
  return sidebarStateByModuleId.principal;
}
