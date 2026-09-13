import type { CartItem, CartTotals } from '@/shared/components/store/store.types';

/** Pedidos a partir deste valor têm entrega grátis. */
export const FREE_DELIVERY_THRESHOLD_CENTS = 7900;
/** Taxa fixa de entrega abaixo do limite. */
export const DELIVERY_FEE_CENTS = 490;

/** Totais do carrinho: subtotal, taxa (zero quando vazio ou acima do limite) e total. */
export function calculateCartTotals(items: readonly CartItem[]): CartTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const isFree = subtotalCents === 0 || subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS;
  const deliveryFeeCents = isFree ? 0 : DELIVERY_FEE_CENTS;

  return {
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    missingForFreeDeliveryCents: isFree ? 0 : FREE_DELIVERY_THRESHOLD_CENTS - subtotalCents,
  };
}
