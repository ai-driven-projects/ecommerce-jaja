/**
 * TEMPLATE — app-modules.ts
 *
 * Substitua os blocos marcados com <<<>>> com os dados reais do novo projeto.
 * Este arquivo controla toda a navegação lateral (SidebarMenu).
 *
 * Instruções:
 *  1. Defina AppModuleId com os IDs dos módulos do projeto.
 *  2. Importe as constantes de rota de cada módulo.
 *  3. Preencha moduleItems e sidebarStateByModuleId.
 *  4. Ajuste getAppModuleItems() se houver variantes de perfil (ex: admin).
 *  5. Ajuste resolveAppSidebarState() se houver rotas especiais.
 */

import {
  // <<<ÍCONES: importe de lucide-react os ícones usados nos módulos e itens>>>
  // Exemplo:
  LayoutDashboard,
  Users,
} from 'lucide-react';
import type { SidebarMenuItem, SidebarMenuSection } from '@/shared/components/ui/sidebar-menu.component';

// <<<IMPORTAÇÕES DE ROTAS: importe as constantes de cada arquivo *-routes.ts>>>
// Exemplo:
// import { DASHBOARD_ROUTE } from '@/shared/navigation/dashboard-routes';
// import { CLIENTS_ROUTE, CLIENTS_LIST_ROUTE } from '@/shared/navigation/clients-routes';

// ── Tipos ──────────────────────────────────────────────────────────────────────

/** IDs dos módulos de navegação principal (rail lateral). */
export type AppModuleId =
  // <<<SUBSTITUA pelos IDs reais>>>
  'module-a' | 'module-b';

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
  // <<<SUBSTITUA pelos módulos reais>>>
  {
    id: 'module-a',
    label: 'Módulo A',
    shortLabel: 'Mod A',
    href: '/module-a',
    icon: LayoutDashboard,
  },
  {
    id: 'module-b',
    label: 'Módulo B',
    shortLabel: 'Mod B',
    href: '/module-b',
    icon: Users,
  },
];

// ── Estado do sidebar por módulo ───────────────────────────────────────────────

const sidebarStateByModuleId: Record<AppModuleId, AppSidebarState> = {
  // <<<SUBSTITUA pelos estados reais de cada módulo>>>
  'module-a': {
    activeModuleId: 'module-a',
    // mainItem: item principal que aparece acima das seções (opcional)
    sections: [
      {
        id: 'module-a-main',
        label: 'Seção A',
        items: [
          {
            id: 'module-a-item-1',
            label: 'Item 1',
            href: '/module-a/item-1',
            icon: LayoutDashboard,
            match: 'prefix',
          },
        ],
      },
    ],
  },
  'module-b': {
    activeModuleId: 'module-b',
    sections: [
      {
        id: 'module-b-main',
        label: 'Seção B',
        items: [
          {
            id: 'module-b-item-1',
            label: 'Item 1',
            href: '/module-b/item-1',
            icon: Users,
            match: 'prefix',
          },
        ],
      },
    ],
  },
};

// ── Funções exportadas ─────────────────────────────────────────────────────────

/**
 * Retorna os itens do rail de módulos.
 * Se houver perfis diferentes (ex: admin), receba um parâmetro e filtre aqui.
 */
export function getAppModuleItems(): AppModuleItem[] {
  return moduleItems;
}

export function getAppModuleNavigationEntries(): AppModuleNavigationEntry[] {
  return getAppModuleItems().map((item) => {
    const sidebarState = sidebarStateByModuleId[item.id];
    return {
      item,
      mainItem: sidebarState.mainItem,
      sections: sidebarState.sections,
    };
  });
}

function getDefaultSidebarState(): AppSidebarState {
  // <<<SUBSTITUA 'module-a' pelo módulo padrão do app>>>
  return sidebarStateByModuleId['module-a'];
}

export function resolveAppSidebarState(pathname: string): AppSidebarState {
  const activeModuleItem = getAppModuleItems().find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  if (activeModuleItem) {
    return sidebarStateByModuleId[activeModuleItem.id];
  }

  return getDefaultSidebarState();
}
