import type { OrderDeliveryAddress } from './order.api';

// Limites espelhados de `@jaja/orders` (`ORDER_RECIPIENT_NAME_MAX_LENGTH` e
// `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH`): o frontend não importa o pacote.
// Mudou lá, muda aqui.

/** Tamanho máximo de "Quem recebe" (mínimo de 2 caracteres, validado pela API). */
export const ORDER_RECIPIENT_NAME_MAX_LENGTH = 100;

/** Tamanho máximo de "Instruções para o entregador". */
export const ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200;

/** Número exibido do pedido: os 8 primeiros caracteres do id em maiúsculas (ex.: `3F1C9A52`). */
export function formatOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

/**
 * Endereço de entrega do pedido em uma linha: `"Rua, número · complemento ·
 * bairro · cidade/UF"`, sem o complemento quando ele é `null` ou vazio.
 */
export function formatOrderAddress(address: OrderDeliveryAddress): string {
  return [`${address.street}, ${address.number}`, address.complement?.trim() || null, address.neighborhood, `${address.city}/${address.state}`]
    .filter(Boolean)
    .join(' · ');
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Hora `HH:MM` de uma data ISO, no fuso do navegador. Use só depois da hidratação. */
export function formatOrderTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Hora `HH:MM:SS` de uma data ISO, no fuso do navegador, para os passos do
 * pedido: o ciclo simulado leva segundos, e só com os segundos dá para ver a
 * demora de cada serviço. Use só depois da hidratação.
 */
export function formatOrderTimeWithSeconds(iso: string): string {
  const date = new Date(iso);
  return `${formatOrderTime(iso)}:${pad(date.getSeconds())}`;
}

/**
 * "Feito hoje às HH:MM" quando o pedido é do mesmo dia de `now`, senão "Feito
 * em DD/MM/AAAA às HH:MM", no fuso do navegador. Depende do relógio: use só
 * depois da hidratação.
 */
export function formatOrderPlacedAt(placedAt: string, now: Date): string {
  const date = new Date(placedAt);
  const time = formatOrderTime(placedAt);
  const isToday =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  if (isToday) return `Feito hoje às ${time}`;
  return `Feito em ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${time}`;
}
