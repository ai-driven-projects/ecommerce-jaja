'use client';

import { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { Trash2, X } from 'lucide-react';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { Price } from '@/shared/components/store/price.component';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { QuantityStepper } from '@/shared/components/store/quantity-stepper.component';
import type { CartItem, CartTotals } from '@/shared/components/store/store.types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/shared/components/ui/sheet';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';

/** Quantidade máxima de um produto no carrinho (o "+" do stepper para aqui). */
const DEFAULT_MAX_QUANTITY = 99;

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totals: CartTotals;
  etaMinutes: number | null;
  /** Primeira carga: blocos estáticos no lugar das linhas. */
  loading?: boolean;
  /** Valores ainda não confirmados: atenuados, e "Finalizar pedido" indisponível. */
  busy?: boolean;
  /** Há linhas indisponíveis: aviso no rodapé, e "Finalizar pedido" indisponível. */
  hasUnavailableItems?: boolean;
  /** Quantidade máxima por produto. */
  maxQuantity?: number;
  /** Link do nome de cada linha para o produto. */
  getHref: (item: CartItem) => string;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
};

// Estrutura estática (sem shimmer) das linhas na primeira carga.
function CartLinesSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Carregando carrinho…</span>
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-3" aria-hidden="true">
          <div className="size-[52px] shrink-0 rounded-xl bg-surface" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-4/5 rounded-md bg-surface" />
            <div className="h-3 w-1/2 rounded-md bg-surface" />
          </div>
          <div className="h-[30px] w-[76px] rounded-pill bg-surface" />
        </div>
      ))}
    </div>
  );
}

type CartLineProps = {
  item: CartItem;
  href: string;
  maxQuantity: number;
  onNavigate: () => void;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
};

function CartLineRow({ item, href, maxQuantity, onNavigate, onChangeQuantity, onRemove }: CartLineProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex min-w-0 flex-1 items-start gap-3', !item.isAvailable && 'opacity-55')}>
        <ProductArt category={item.category} imageUrl={item.imageUrl} alt={item.name} size="sm" />
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            onClick={onNavigate}
            title={item.name}
            className="line-clamp-2 text-[13.5px] font-bold leading-[1.3] text-ink transition-colors duration-150 hover:text-brand"
          >
            {item.name}
          </Link>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-ink">
            {item.unit} · {formatPrice(item.priceCents)}
          </p>
          {item.isAvailable ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <QuantityStepper
                size="sm"
                quantity={item.quantity}
                max={maxQuantity}
                onChange={(quantity) => onChangeQuantity(item.productId, quantity)}
                itemName={item.name}
              />
              {item.lineTotalCents !== null ? (
                <Price cents={item.lineTotalCents} className="justify-end text-[13.5px]" />
              ) : null}
            </div>
          ) : (
            <Badge variant="danger" className="mt-2">
              Indisponível
            </Badge>
          )}
        </div>
      </div>
      {item.isAvailable ? (
        <button
          type="button"
          aria-label={`Remover ${item.name} do carrinho`}
          onClick={() => onRemove(item.productId)}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-ink transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Remover ${item.name} do carrinho`}
          onClick={() => onRemove(item.productId)}
          className="shrink-0"
        >
          <Trash2 className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          Remover
        </Button>
      )}
    </div>
  );
}

// Gaveta do carrinho (Radix Dialog): foco inicial, Escape e clique no fundo
// vêm do Radix. Como é controlada (sem `SheetTrigger`), o retorno do foco ao
// elemento que a abriu é feito aqui. Os valores vêm prontos das props (da API).
export function CartDrawer({
  open,
  onClose,
  items,
  totals,
  etaMinutes,
  loading = false,
  busy = false,
  hasUnavailableItems = false,
  maxQuantity = DEFAULT_MAX_QUANTITY,
  getHref,
  onChangeQuantity,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  const hasItems = items.length > 0;
  const openerRef = useRef<HTMLElement | null>(null);
  const canCheckout = hasItems && !loading && !busy && !hasUnavailableItems;

  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
          openerRef.current = null;
        }}
        className="flex max-w-full flex-col gap-0 p-0"
      >
        <div className="flex items-center justify-between border-b border-line px-[22px] py-5">
          <SheetTitle>Seu carrinho</SheetTitle>
          <SheetClose
            aria-label="Fechar carrinho"
            className="flex size-[34px] items-center justify-center rounded-full border border-line bg-card text-muted-ink transition-colors duration-150 hover:bg-surface"
          >
            <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </SheetClose>
        </div>

        {etaMinutes !== null ? (
          <div className="mx-[22px] mt-3.5 flex items-center gap-2.5 rounded-xl bg-success-soft px-3.5 py-[11px] text-[13.5px] font-bold text-success-strong">
            <BikeIcon className="size-4 shrink-0 text-success" strokeWidth={2} />
            Saindo de bike · chega em ~{etaMinutes} min
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-3.5">
          {loading ? (
            <CartLinesSkeleton />
          ) : hasItems ? (
            items.map((item) => (
              <CartLineRow
                key={item.productId}
                item={item}
                href={getHref(item)}
                maxQuantity={maxQuantity}
                onNavigate={onClose}
                onChangeQuantity={onChangeQuantity}
                onRemove={onRemove}
              />
            ))
          ) : (
            <div className="px-3 py-12 text-center text-sm text-muted-ink">
              <div className="mb-2.5 text-[40px] leading-none" aria-hidden="true">
                🛒
              </div>
              Seu carrinho está vazio.
              <br />
              Adicione itens para o escritório!
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line px-[22px] pb-5 pt-4 text-[13.5px]">
          <div aria-busy={busy} className={cn('flex flex-col gap-2 transition-opacity duration-150', busy && 'opacity-50')}>
            <div className="flex justify-between text-muted-ink">
              <span>Subtotal</span>
              <span className="font-bold tabular-nums text-ink">{formatPrice(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-muted-ink">
              <span>Entrega de bike</span>
              {totals.deliveryFeeCents === 0 ? (
                <span className="font-extrabold text-success">Grátis</span>
              ) : (
                <span className="font-bold tabular-nums text-ink">{formatPrice(totals.deliveryFeeCents)}</span>
              )}
            </div>
            {hasItems && totals.missingForFreeDeliveryCents > 0 ? (
              <p className="text-xs text-muted-ink">
                Faltam <strong className="text-ink">{formatPrice(totals.missingForFreeDeliveryCents)}</strong> para a entrega grátis.
              </p>
            ) : null}
            <div className="mt-1 flex justify-between text-[17px] font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(totals.totalCents)}</span>
            </div>
          </div>

          {hasItems && hasUnavailableItems ? (
            <p role="status" className="mt-1 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-bold text-danger">
              Remova os itens indisponíveis para continuar.
            </p>
          ) : null}

          <Button type="button" size="xl" disabled={!canCheckout} onClick={onCheckout} className="mt-2.5 w-full">
            Finalizar pedido · {formatPrice(totals.totalCents)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
