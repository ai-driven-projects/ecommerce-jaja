import type { EventTimelineEntry } from './admin-order.api';

// Formatação do painel do pedido no admin (`/admin/orders/:id`). Horários no
// fuso do navegador: use só depois da hidratação.

const SECOND_MS = 1_000;
const MINUTE_S = 60;
const HOUR_S = 3_600;
const DAY_S = 86_400;

/** Tamanho dos ids abreviados (mensagem, causa e correlação), como o número do pedido. */
export const SHORT_ID_LENGTH = 8;

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Id abreviado aos 8 primeiros caracteres (ex.: `3f1c9a52`); o id completo vai no `title`. */
export function shortId(id: string): string {
  return id.slice(0, SHORT_ID_LENGTH);
}

/** Hora `HH:MM:SS.mmm` de uma data ISO, para os eventos (o ciclo inteiro dura segundos). */
export function formatTimeWithMillis(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/**
 * Duração legível, arredondada para baixo ao segundo: "21 s", "3 min 12 s" (ou
 * "3 min" com 0 s), "2 h 5 min" e "3 d 4 h". Negativa vale 0 (relógios diferentes).
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / SECOND_MS));

  if (totalSeconds < MINUTE_S) return `${totalSeconds} s`;
  if (totalSeconds < HOUR_S) {
    const minutes = Math.floor(totalSeconds / MINUTE_S);
    const seconds = totalSeconds % MINUTE_S;
    return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
  }
  if (totalSeconds < DAY_S) {
    const hours = Math.floor(totalSeconds / HOUR_S);
    const minutes = Math.floor((totalSeconds % HOUR_S) / MINUTE_S);
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
  }
  const days = Math.floor(totalSeconds / DAY_S);
  const hours = Math.floor((totalSeconds % DAY_S) / HOUR_S);
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}

/**
 * Duração de `from` a `to` (datas ISO) entre dois passos: abaixo de 1 min com uma
 * casa decimal ("+3,2 s"); daí em diante como `formatDuration` ("+3 min 12 s").
 */
export function formatStepDelta(from: string, to: string): string {
  const ms = Math.max(0, new Date(to).getTime() - new Date(from).getTime());
  if (ms < MINUTE_S * SECOND_MS) return `+${decimal.format(Math.floor(ms / 100) / 10)} s`;
  return `+${formatDuration(ms)}`;
}

/** Espera do consumidor em segundos: "3 s", "1,5 s". */
export function formatDelay(delayMs: number): string {
  return `${decimal.format(delayMs / SECOND_MS)} s`;
}

/**
 * Correlação da cadeia de eventos do pedido: a `correlationId` do primeiro evento
 * que a tem ou, sem nenhuma, o id do primeiro evento (o `order.placed` abre a
 * cadeia e é a correlação dos seguintes). `null` sem eventos.
 */
export function correlationOf(events: readonly EventTimelineEntry[]): string | null {
  return events.find((event) => event.correlationId)?.correlationId ?? events[0]?.id ?? null;
}

/** "Em N s" até `expectedAt` (arredondado para cima); `null` quando o horário já passou. */
export function formatCountdown(expectedAt: string, now: number): string | null {
  const remaining = Math.ceil((new Date(expectedAt).getTime() - now) / SECOND_MS);
  return remaining > 0 ? `em ${remaining} s` : null;
}
