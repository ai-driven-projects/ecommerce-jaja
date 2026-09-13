'use client';

import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { Price } from '@/shared/components/store/price.component';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { QuantityStepper } from '@/shared/components/store/quantity-stepper.component';
import type { CartItem, CartTotals } from '@/shared/components/store/store.types';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/shared/components/ui/sheet';
import { formatPrice } from '@/shared/util/price.util';

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totals: CartTotals;
  etaMinutes: number | null;
  onChangeQuantity: (productId: string, quantity: number) => void;
  onCheckout: () => void;
};

// Gaveta do carrinho (Radix Dialog): foco inicial, Escape e clique no fundo
// vêm do Radix. Como é controlada (sem `SheetTrigger`), o retorno do foco ao
// elemento que a abriu é feito aqui.
export function CartDrawer({ open, onClose, items, totals, etaMinutes, onChangeQuantity, onCheckout }: CartDrawerProps) {
  const hasItems = items.length > 0;
  const openerRef = useRef<HTMLElement | null>(null);

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
        className="flex flex-col gap-0 p-0"
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-[22px] py-3.5">
          {hasItems ? (
            items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <ProductArt emoji={item.emoji} category={item.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold leading-[1.3]">{item.name}</p>
                  <p className="text-[12.5px] text-muted-ink">{formatPrice(item.priceCents)}</p>
                </div>
                <QuantityStepper
                  size="sm"
                  quantity={item.quantity}
                  onChange={(quantity) => onChangeQuantity(item.productId, quantity)}
                  itemName={item.name}
                />
                <Price cents={item.priceCents * item.quantity} className="min-w-16 justify-end text-[13.5px]" />
              </div>
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
          <div className="flex justify-between text-muted-ink">
            <span>Subtotal</span>
            <span className="font-bold text-ink">{formatPrice(totals.subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-muted-ink">
            <span>Entrega de bike</span>
            {totals.deliveryFeeCents === 0 ? (
              <span className="font-extrabold text-success">Grátis</span>
            ) : (
              <span className="font-bold text-ink">{formatPrice(totals.deliveryFeeCents)}</span>
            )}
          </div>
          {hasItems && totals.missingForFreeDeliveryCents > 0 ? (
            <p className="text-xs text-muted-ink">
              Faltam <strong className="text-ink">{formatPrice(totals.missingForFreeDeliveryCents)}</strong> para a entrega grátis.
            </p>
          ) : null}
          <div className="mt-1 flex justify-between text-[17px] font-extrabold">
            <span>Total</span>
            <span>{formatPrice(totals.totalCents)}</span>
          </div>

          <Button type="button" size="xl" disabled={!hasItems} onClick={onCheckout} className="mt-2.5 w-full">
            Finalizar pedido · {formatPrice(totals.totalCents)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
