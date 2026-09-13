'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Circle } from 'lucide-react';
import { cn } from '@/shared/lib/class-name.util';

type SidebarIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

export type SidebarMenuItem = {
  id: string;
  label: string;
  shortLabel?: string;
  href: string;
  icon?: SidebarIcon;
  match?: 'exact' | 'prefix';
  excludeHrefs?: string[];
  /** Contador laranja à direita (ex.: pedidos em andamento). */
  badge?: string | number;
};

export type SidebarMenuSection = {
  id: string;
  label?: string;
  items: SidebarMenuItem[];
};

export type SidebarMenuProps = {
  /** Itens principais (módulos). */
  items: SidebarMenuItem[];
  /** Sub-itens do módulo ativo, agrupados por seção; exibidos quando houver mais de um no total. */
  sections?: SidebarMenuSection[];
  className?: string;
};

/**
 * `active`: item destacado (laranja). `expanded`: módulo aberto cujo sub-item
 * está destacado — fica com texto claro, sem fundo, para nunca haver dois itens
 * marcados ao mesmo tempo. `idle`: demais itens.
 */
type SidebarItemState = 'active' | 'expanded' | 'idle';

export function isSidebarItemActive(pathname: string, item: SidebarMenuItem): boolean {
  if (item.excludeHrefs?.some((excluded) => pathname === excluded || pathname.startsWith(`${excluded}/`))) {
    return false;
  }
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Item da barra escura: raio 12, texto cinza-claro; o ativo fica laranja com
// texto branco. Hover clareia o fundo.
function SidebarItemLink({ item, state, nested = false }: { item: SidebarMenuItem; state: SidebarItemState; nested?: boolean }) {
  const Icon = item.icon ?? Circle;
  const active = state === 'active';

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-[11px] rounded-xl px-[13px] py-[11px] text-sm font-bold transition-colors duration-150',
        active && 'bg-brand text-white',
        state === 'expanded' && 'text-white hover:bg-dark-surface',
        state === 'idle' && 'text-dark-muted hover:bg-dark-surface hover:text-white',
        nested && 'py-2 pl-11 text-[13px]',
      )}
    >
      {!nested ? <Icon className="size-[18px] shrink-0" strokeWidth={2.2} /> : null}
      <span className="truncate">{item.label}</span>
      {item.badge !== undefined && item.badge !== '' ? (
        <span
          className={cn(
            'ml-auto rounded-pill px-2 py-0.5 text-[11.5px] font-extrabold',
            active ? 'bg-white text-brand' : 'bg-brand text-white',
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Navegação de nível único para a barra lateral escura do admin. */
export function SidebarMenu({ items, sections = [], className }: SidebarMenuProps) {
  const pathname = usePathname();
  // Seções vazias somem com o rótulo; sub-itens só aparecem com mais de um no total.
  const visibleSections = sections.filter((section) => section.items.length > 0);
  const showNested = visibleSections.reduce((total, section) => total + section.items.length, 0) > 1;
  const nestedActive =
    showNested && visibleSections.some((section) => section.items.some((nested) => isSidebarItemActive(pathname, nested)));

  return (
    <nav aria-label="Menu administrativo" className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => {
        const active = isSidebarItemActive(pathname, item);
        // Só um item destacado por vez: com sub-item ativo, o módulo fica apenas expandido.
        const state: SidebarItemState = !active ? 'idle' : nestedActive ? 'expanded' : 'active';
        return (
          <div key={item.id} className="flex flex-col gap-0.5">
            <SidebarItemLink item={item} state={state} />
            {active && showNested
              ? visibleSections.map((section) => {
                  const labelId = `sidebar-section-${section.id}-label`;
                  return (
                    <div
                      key={section.id}
                      role="group"
                      aria-labelledby={section.label ? labelId : undefined}
                      className="flex flex-col gap-0.5"
                    >
                      {section.label ? (
                        <div
                          id={labelId}
                          className="pb-1 pl-11 pr-[13px] pt-2 text-xs font-extrabold uppercase tracking-[0.04em] text-dark-muted"
                        >
                          {section.label}
                        </div>
                      ) : null}
                      {section.items.map((nested) => (
                        <SidebarItemLink
                          key={nested.id}
                          item={nested}
                          state={isSidebarItemActive(pathname, nested) ? 'active' : 'idle'}
                          nested
                        />
                      ))}
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}
    </nav>
  );
}
