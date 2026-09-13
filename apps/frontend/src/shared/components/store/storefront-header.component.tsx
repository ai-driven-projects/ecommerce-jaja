'use client';

import type { ReactNode, Ref } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, ShieldCheck, ShoppingCart, UserRound } from 'lucide-react';
import { AppLogo } from '@/shared/components/branding/app-logo.component';
import { DeliveryPill } from '@/shared/components/store/delivery-pill.component';
import { StorefrontSearch } from '@/shared/components/store/storefront-search.component';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/class-name.util';

type StorefrontHeaderProps = {
  neighborhood: string;
  neighborhoods: string[];
  etaMinutes: number | null;
  cartCount: number;
  onNeighborhoodChange: (neighborhood: string) => void;
  onOpenCart: () => void;
  cartButtonRef?: Ref<HTMLButtonElement>;
  /** Nome do cliente autenticado; com ele o cabeçalho mostra o primeiro nome e "Sair". */
  userName?: string | null;
  /** Destino do botão "Entrar", exibido só quando não há `userName`. */
  signInHref?: string;
  onSignOut?: () => void;
  /** Com sessão de administrador, o menu da conta ganha o link para a área administrativa. */
  isAdmin?: boolean;
  adminHref?: string;
  /** Conteúdo abaixo da linha principal (ex.: chips de categoria). */
  children?: ReactNode;
  className?: string;
};

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

// Controle de conta: com sessão → pílula com o primeiro nome e menu (área
// administrativa para admins, "Sair"); sem sessão → botão "Entrar" em contorno.
function AccountControl({
  userName,
  signInHref,
  onSignOut,
  isAdmin,
  adminHref,
}: Pick<StorefrontHeaderProps, 'userName' | 'signInHref' | 'onSignOut' | 'isAdmin' | 'adminHref'>) {
  if (userName) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1.5 pl-2.5 pr-3.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-brand">
              <UserRound className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            </span>
            {firstNameOf(userName)}
            <ChevronDown className="size-3.5 text-muted-ink" strokeWidth={2.5} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-extrabold">{userName}</p>
            <p className="text-xs text-muted-ink">{isAdmin ? 'Administrador' : 'Conta do escritório'}</p>
          </div>
          <DropdownMenuSeparator />
          {isAdmin && adminHref ? (
            <DropdownMenuItem asChild>
              <Link href={adminHref}>
                <ShieldCheck className="size-4" strokeWidth={2.2} aria-hidden="true" />
                Área administrativa
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onSignOut} className="text-danger focus:text-danger">
            <LogOut className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (signInHref) {
    return (
      <Button asChild variant="outline">
        <Link href={signInHref}>Entrar</Link>
      </Button>
    );
  }

  return null;
}

/**
 * Cabeçalho da loja: fixo no topo, branco, com logo, pílula de entrega,
 * busca, conta e o botão laranja do carrinho.
 */
export function StorefrontHeader({
  neighborhood,
  neighborhoods,
  etaMinutes,
  cartCount,
  onNeighborhoodChange,
  onOpenCart,
  cartButtonRef,
  userName,
  signInHref,
  onSignOut,
  isAdmin,
  adminHref,
  children,
  className,
}: StorefrontHeaderProps) {
  return (
    <header className={cn('sticky top-0 z-40 border-b border-line bg-card', className)}>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="já já — voltar à vitrine">
          <AppLogo size="lg" />
        </Link>

        <DeliveryPill
          neighborhood={neighborhood}
          neighborhoods={neighborhoods}
          etaMinutes={etaMinutes}
          onNeighborhoodChange={onNeighborhoodChange}
          className="max-w-full"
        />

        <StorefrontSearch className="order-last w-full flex-1 md:order-none md:min-w-[220px] md:basis-0" />

        <div className="ml-auto flex items-center gap-2.5">
          <AccountControl
            userName={userName}
            signInHref={signInHref}
            onSignOut={onSignOut}
            isAdmin={isAdmin}
            adminHref={adminHref}
          />

          <Button ref={cartButtonRef} type="button" onClick={onOpenCart} aria-label={`Abrir carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden sm:inline">Carrinho</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-card px-1.5 text-xs font-extrabold text-brand">
              {cartCount}
            </span>
          </Button>
        </div>
      </div>

      {children ? <div className="mx-auto max-w-[1240px] px-4 pb-3 sm:px-6">{children}</div> : null}
    </header>
  );
}

type CompactHeaderProps = {
  /** Conteúdo à direita do logo (ex.: "Checkout seguro" ou "Voltar para a loja →"). */
  aside?: ReactNode;
  /** Largura do container: a loja usa 1240; checkout e acompanhamento, 1080. */
  width?: 'wide' | 'narrow';
};

/** Cabeçalho reduzido para checkout e acompanhamento: logo à esquerda e um único aviso/link à direita. */
export function CompactStorefrontHeader({ aside, width = 'narrow' }: CompactHeaderProps) {
  return (
    <header className="border-b border-line bg-card">
      <div
        className={cn(
          'mx-auto flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6',
          width === 'wide' ? 'max-w-[1240px]' : 'max-w-[1080px]',
        )}
      >
        <Link href="/" className="shrink-0" aria-label="já já — voltar à vitrine">
          <AppLogo size="lg" />
        </Link>
        {aside}
      </div>
    </header>
  );
}
