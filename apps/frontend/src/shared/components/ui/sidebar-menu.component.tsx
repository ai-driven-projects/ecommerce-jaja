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
  /** Sub-itens do módulo ativo, quando houver mais de um. */
  sections?: SidebarMenuSection[];
  className?: string;
};

export function isSidebarItemActive(pathname: string, item: SidebarMenuItem): boolean {
  if (item.excludeHrefs?.some((excluded) => pathname === excluded || pathname.startsWith(`${excluded}/`))) {
    return false;
  }
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Item da barra escura: raio 12, texto cinza-claro; o ativo fica laranja com
// texto branco. Hover clareia o fundo.
function SidebarItemLink({ item, active, nested = false }: { item: SidebarMenuItem; active: boolean; nested?: boolean }) {
  const Icon = item.icon ?? Circle;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-[11px] rounded-xl px-[13px] py-[11px] text-sm font-bold transition-colors duration-150',
        active ? 'bg-brand text-white' : 'text-dark-muted hover:bg-dark-surface hover:text-white',
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
  const nestedItems = sections.flatMap((section) => section.items);
  const showNested = nestedItems.length > 1;

  return (
    <nav aria-label="Menu administrativo" className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => {
        const active = isSidebarItemActive(pathname, item);
        return (
          <div key={item.id} className="flex flex-col gap-0.5">
            <SidebarItemLink item={item} active={active} />
            {active && showNested
              ? nestedItems.map((nested) => (
                  <SidebarItemLink key={nested.id} item={nested} active={isSidebarItemActive(pathname, nested)} nested />
                ))
              : null}
          </div>
        );
      })}
    </nav>
  );
}
