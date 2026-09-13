'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronDown, ExternalLink, LogOut, Menu, UserRound } from 'lucide-react';
import { AppLogo, AppLogoMark, AppWordmark } from '@/shared/components/branding/app-logo.component';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet';
import { useShell } from '@/shared/hooks/shell.hook';
import { cn } from '@/shared/lib/class-name.util';

type AdminShellProps = {
  /** Navegação (lista de itens) renderizada dentro da barra lateral escura. */
  sidebar: ReactNode;
  children: ReactNode;
  logoHref?: string;
  /** Rótulo pequeno abaixo do logo (ex.: "OPERAÇÃO"). */
  areaLabel?: string;
  storeHref?: string;
  userName?: string;
  userEmail?: string;
  /** Linha abaixo do nome no rodapé da barra; sem ela, mostra o e-mail. */
  userSubtitle?: string;
  userAvatarUrl?: string | null;
  profileHref?: string;
  onLogout?: () => void;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '·';
}

type UserMenuProps = Pick<AdminShellProps, 'userName' | 'userEmail' | 'userSubtitle' | 'userAvatarUrl' | 'profileHref' | 'storeHref' | 'onLogout'>;

// Rodapé da barra: avatar + nome + subtítulo (ou e-mail), com menu (loja, perfil, sair).
function UserMenu({ userName = 'Usuário', userEmail, userSubtitle, userAvatarUrl, profileHref, storeHref, onLogout }: UserMenuProps) {
  const router = useRouter();
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const resolvedAvatarUrl = userAvatarUrl && failedAvatarUrl !== userAvatarUrl ? userAvatarUrl : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 border-t border-dark-line px-5 py-4 text-left transition-colors duration-150 hover:bg-dark-surface"
        >
          {resolvedAvatarUrl ? (
            <Image
              src={resolvedAvatarUrl}
              alt={`Avatar de ${userName}`}
              className="size-[34px] rounded-full object-cover"
              onError={() => setFailedAvatarUrl(userAvatarUrl ?? null)}
              width={34}
              height={34}
            />
          ) : (
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand-light text-[13px] font-extrabold text-dark">
              {initialsOf(userName)}
            </span>
          )}
          <span className="min-w-0 flex-1 text-[12.5px]">
            <span className="block truncate font-extrabold text-white">{userName}</span>
            <span className="block truncate text-dark-muted">{userSubtitle ?? userEmail}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-dark-muted" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-extrabold">{userName}</p>
          {userEmail ? <p className="truncate text-xs text-muted-ink">{userEmail}</p> : null}
        </div>
        <DropdownMenuSeparator />
        {storeHref ? (
          <DropdownMenuItem onSelect={() => router.push(storeHref)}>
            <ExternalLink className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Ver loja
          </DropdownMenuItem>
        ) : null}
        {profileHref ? (
          <DropdownMenuItem onSelect={() => router.push(profileHref)}>
            <UserRound className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Perfil
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onLogout} className="text-danger focus:text-danger">
          <LogOut className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SidebarPanelProps = AdminShellProps & { onNavigate?: () => void };

// Conteúdo da barra lateral escura: logo, navegação e o usuário no rodapé.
function SidebarPanel({ sidebar, logoHref = '/admin', areaLabel = 'Operação', onNavigate, ...user }: SidebarPanelProps) {
  return (
    <div className="flex h-full flex-col bg-dark text-white">
      <Link href={logoHref} onClick={onNavigate} className="flex items-center gap-2.5 px-5 py-[22px]" aria-label="Ir para o dashboard">
        <AppLogoMark size="md" />
        <span className="flex flex-col">
          <AppWordmark size="md" tone="light" />
          <span className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.5px] text-dark-muted">{areaLabel}</span>
        </span>
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" onClick={onNavigate}>
        {sidebar}
      </div>

      <UserMenu {...user} />
    </div>
  );
}

/**
 * Shell administrativo: barra lateral escura fixa (236px) no desktop e uma
 * gaveta no mobile, com barra superior branca só no mobile.
 */
export function AdminShell(props: AdminShellProps) {
  const { children, logoHref = '/admin' } = props;
  const { isSidebarOpen, isMobile, setSidebarOpen, toggleSidebar } = useShell();

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 lg:block">
        <SidebarPanel {...props} />
      </aside>

      <Sheet open={isMobile && isSidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="w-[280px] overflow-hidden bg-dark p-0 text-white">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarPanel {...props} onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-card px-4 lg:hidden">
          <Button variant="outline" size="icon" onClick={toggleSidebar} aria-label="Abrir menu">
            <Menu className="size-5" strokeWidth={2.2} />
          </Button>
          <Link href={logoHref} aria-label="Ir para o dashboard">
            <AppLogo size="sm" />
          </Link>
        </header>

        <main className={cn('min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-[30px] lg:pb-11 lg:pt-[26px]')}>{children}</main>
      </div>
    </div>
  );
}
