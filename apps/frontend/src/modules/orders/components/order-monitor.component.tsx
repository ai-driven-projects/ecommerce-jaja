'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useClientSecond } from '@/shared/hooks/use-client-clock.hook';
import { ordersRoute } from '@/shared/navigation/orders-routes';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import { formatPhone } from '@/shared/util/phone.util';
import type { EventTimelineConsumer, EventTimelineEntry, OrderAdminDetail } from '../data/admin-order.api';
import {
  correlationOf,
  formatCountdown,
  formatDelay,
  formatDuration,
  formatStepDelta,
  formatTimeWithMillis,
  shortId,
} from '../data/order-monitor.util';
import { ORDER_STEPS, orderStepState } from '../data/order-status.util';
import { formatOrderAddress, formatOrderNumber, formatOrderTimeWithSeconds } from '../data/order.util';
import { useOrdersLive } from '../data/orders-live.context';
import { useAdminOrder } from '../data/use-admin-order.hook';
import { LiveIndicator } from './live-indicator.component';
import { OrderStatusBadge } from './order-status-badge.component';

const CARD_CLASS = 'min-w-0 rounded-2xl border border-line bg-card px-5 py-5 sm:px-[22px]';
const CARD_TITLE_CLASS = 'font-display text-[17px] font-extrabold';

/** O item do pedido não tem categoria: a reserva é a padrão (🛒 sobre `--tint-green`), como no acompanhamento. */
const ORDER_ITEM_ART_CATEGORY = '';

/** Âncora do cartão de um evento, alvo do link "causado por". */
const eventAnchor = (eventId: string) => `event-${eventId}`;

// ── Estados da página ─────────────────────────────────────────────────────────

// Estrutura estática (sem shimmer) durante a primeira leitura.
function MonitorSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">Carregando o pedido…</span>
      <div aria-hidden="true" className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <div className="h-4 w-20 rounded-md bg-surface" />
          <div className="h-8 w-72 max-w-full rounded-md bg-surface" />
          <div className="h-4 w-60 max-w-full rounded-md bg-surface" />
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className={CARD_CLASS}>
              <div className="mb-5 h-5 w-28 rounded-md bg-surface" />
              <div className="flex flex-col gap-5">
                {ORDER_STEPS.map((step) => (
                  <div key={step.status} className="flex items-center gap-3.5">
                    <div className="size-[26px] shrink-0 rounded-full bg-surface" />
                    <div className="h-4 w-40 rounded-md bg-surface" />
                  </div>
                ))}
              </div>
            </div>
            <div className={cn(CARD_CLASS, 'h-44')} />
          </div>
          <div className={CARD_CLASS}>
            <div className="mb-5 h-5 w-24 rounded-md bg-surface" />
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-28 rounded-xl bg-surface" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aviso centralizado (pedido não encontrado ou erro de carga), com o retorno à lista.
function MonitorNotice({ emoji, title, backHref }: { emoji: string; title: string; backHref: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-line bg-card px-6 py-12 text-center">
      <span className="text-[40px] leading-none" aria-hidden="true">
        {emoji}
      </span>
      <h1 className="mt-2 font-display text-xl font-extrabold tracking-[-0.3px]">{title}</h1>
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href={backHref}>Voltar para os pedidos</Link>
      </Button>
    </div>
  );
}

// ── Cabeçalho ─────────────────────────────────────────────────────────────────

// "Feito às HH:MM:SS · há X" (atualizado a cada segundo) e, entregue, "Entregue em Y". Relógio só depois da hidratação.
function PlacedLine({ order }: { order: OrderAdminDetail }) {
  const now = useClientSecond();
  const placedAt = now === null ? '…' : formatOrderTimeWithSeconds(order.placedAt);
  const elapsed = now === null ? '…' : formatDuration(now - new Date(order.placedAt).getTime());
  const deliveredIn =
    order.deliveredAt === null ? null : formatDuration(new Date(order.deliveredAt).getTime() - new Date(order.placedAt).getTime());

  return (
    <p className="text-[13.5px] text-muted-ink">
      Feito às <span className="tabular-nums">{placedAt}</span> · há <span className="tabular-nums">{elapsed}</span>
      {deliveredIn ? (
        <>
          {' · '}
          <strong className="font-extrabold text-success">Entregue em {deliveredIn}</strong>
        </>
      ) : null}
    </p>
  );
}

// ── Progresso ─────────────────────────────────────────────────────────────────

function ProgressCard({ order }: { order: OrderAdminDetail }) {
  // Status com que o painel abriu: os passos concluídos depois dele recebem o destaque breve.
  const [openedStatus] = useState(order.status);
  const openedIndex = ORDER_STEPS.findIndex((step) => step.status === openedStatus);

  return (
    <section className={CARD_CLASS}>
      <h2 className={cn(CARD_TITLE_CLASS, 'mb-4')}>Progresso</h2>
      {/* `aria-live`: leitores de tela anunciam o avanço dos passos sem mover o foco. */}
      <ol className="flex flex-col" aria-live="polite">
        {ORDER_STEPS.map((step, index) => {
          const state = orderStepState(order, index);
          const done = state === 'done';
          const current = state === 'current';
          const date = order[step.dateKey];
          const previousDate = index > 0 ? order[ORDER_STEPS[index - 1].dateKey] : null;
          const isLast = index === ORDER_STEPS.length - 1;

          return (
            <li
              key={step.status}
              className={cn(
                '-mx-2 -mt-1 flex gap-3.5 rounded-xl px-2 pt-1',
                done && index > openedIndex && 'motion-safe:animate-step-done',
              )}
            >
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold text-white',
                    done && 'border-success bg-success',
                    current && 'border-brand bg-brand-soft',
                    state === 'pending' && 'border-line bg-card',
                  )}
                  aria-hidden="true"
                >
                  {done ? '✓' : null}
                  {current ? <span className="size-2 rounded-full bg-brand" /> : null}
                </span>
                {!isLast ? <span className={cn('min-h-[22px] w-0.5 flex-1', done ? 'bg-success' : 'bg-line')} aria-hidden="true" /> : null}
              </div>
              <div className="min-w-0 pb-4">
                <div className={cn('text-[14.5px] font-extrabold', state === 'pending' ? 'text-placeholder' : 'text-ink')}>
                  {done ? <span className="sr-only">Concluído: </span> : null}
                  {step.label}
                </div>
                {done && date ? (
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] tabular-nums text-muted-ink">
                    <span>{formatOrderTimeWithSeconds(date)}</span>
                    {previousDate ? <span className="font-bold text-ink-soft">{formatStepDelta(previousDate, date)}</span> : null}
                  </div>
                ) : (
                  <div className={cn('mt-0.5 text-[12.5px]', current ? 'font-bold text-brand motion-safe:animate-pulse-soft' : 'text-muted-ink')}>
                    {current ? 'Em andamento…' : 'Aguardando'}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ── Cliente e itens ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[12.5px] font-bold text-muted-ink">{label}</dt>
      <dd className="min-w-0 break-words text-[13.5px] text-ink">{children}</dd>
    </div>
  );
}

function CustomerCard({ order }: { order: OrderAdminDetail }) {
  const phone = formatPhone(order.customer.phone);

  return (
    <section className={CARD_CLASS}>
      <h2 className={cn(CARD_TITLE_CLASS, 'mb-3.5')}>Cliente e entrega</h2>
      <dl className="flex flex-col gap-2.5">
        <InfoRow label="Cliente">
          <span className="font-bold">{order.customer.name}</span>
        </InfoRow>
        <InfoRow label="E-mail">
          <a href={`mailto:${order.customer.email}`} className="break-all transition-colors duration-150 hover:text-brand">
            {order.customer.email}
          </a>
        </InfoRow>
        <InfoRow label="Telefone">
          <span className="tabular-nums">{phone || '—'}</span>
        </InfoRow>
        <InfoRow label="Endereço">{formatOrderAddress(order.deliveryAddress)}</InfoRow>
        <InfoRow label="Quem recebe">{order.recipientName}</InfoRow>
        <InfoRow label="Instruções">
          {order.deliveryInstructions ? (
            <span className="whitespace-pre-line">{order.deliveryInstructions}</span>
          ) : (
            <span className="text-muted-ink">—</span>
          )}
        </InfoRow>
      </dl>
    </section>
  );
}

function ItemsCard({ order }: { order: OrderAdminDetail }) {
  return (
    <section className={CARD_CLASS}>
      <h2 className={cn(CARD_TITLE_CLASS, 'mb-3')}>Itens</h2>
      <ul className="mb-4 flex flex-col gap-3">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-center gap-2.5">
            <ProductArt category={ORDER_ITEM_ART_CATEGORY} imageUrl={item.thumbUrl} alt={item.name} size="xs" />
            <div className="min-w-0 flex-1 text-[13.5px] font-bold leading-[1.3]">
              <span className="line-clamp-2" title={item.name}>
                {item.name}
              </span>
              <span className="font-semibold text-muted-ink">× {item.quantity}</span>
            </div>
            <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">{formatPrice(item.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-[7px] border-t border-dashed border-line pt-3 text-[13.5px]">
        <div className="flex justify-between text-muted-ink">
          <span>Subtotal</span>
          <span className="font-bold tabular-nums text-ink">{formatPrice(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-muted-ink">
          <span>Entrega</span>
          {order.deliveryFeeCents === 0 ? (
            <span className="font-extrabold text-success">Grátis</span>
          ) : (
            <span className="font-bold tabular-nums text-ink">{formatPrice(order.deliveryFeeCents)}</span>
          )}
        </div>
        <div className="mt-1 flex justify-between text-[16px] font-extrabold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(order.totalCents)}</span>
        </div>
      </div>
    </section>
  );
}

// ── Eventos ───────────────────────────────────────────────────────────────────

// Consumidor aguardando: espera configurada, contagem regressiva até `expectedAt` e depois "processando…".
function WaitingConsumerState({ consumer }: { consumer: EventTimelineConsumer }) {
  const now = useClientSecond();
  const parts = ['Aguardando'];
  if (consumer.delayMs !== null) parts.push(`espera de ${formatDelay(consumer.delayMs)}`);
  if (consumer.expectedAt !== null) {
    parts.push(now === null ? '…' : (formatCountdown(consumer.expectedAt, now) ?? 'processando…'));
  }

  return <span className="font-bold text-warning motion-safe:animate-pulse-soft">{parts.join(' · ')}</span>;
}

function ConsumerRow({ consumer }: { consumer: EventTimelineConsumer }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
      <span className="break-all font-mono font-bold text-ink">{consumer.name}</span>
      {!consumer.registered ? (
        <Badge variant="muted" className="px-2 py-0.5 text-[11px]">
          não registrado nesta instância
        </Badge>
      ) : null}
      {consumer.state === 'processed' ? (
        <span className="font-bold text-success">
          Processado às <span className="tabular-nums">{consumer.processedAt ? formatOrderTimeWithSeconds(consumer.processedAt) : '…'}</span>
        </span>
      ) : consumer.state === 'waiting' ? (
        <WaitingConsumerState consumer={consumer} />
      ) : (
        <span className="text-muted-ink">Aguardando publicação</span>
      )}
    </li>
  );
}

function OutboxLine({ event }: { event: EventTimelineEntry }) {
  const { outbox } = event;

  if (outbox.status === 'PUBLISHED' && outbox.publishedAt) {
    return (
      <p className="text-[12.5px] font-bold text-success">
        Publicado às <span className="tabular-nums">{formatTimeWithMillis(outbox.publishedAt)}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-[12.5px]">
      <p className="font-bold text-warning">
        Pendente
        {outbox.attempts > 0 ? (
          <span className="font-semibold text-muted-ink">
            {' · '}
            {outbox.attempts} {outbox.attempts === 1 ? 'tentativa' : 'tentativas'}
          </span>
        ) : null}
      </p>
      {outbox.lastError ? (
        <p className="break-words rounded-lg bg-danger-soft px-2.5 py-1.5 font-mono text-[11.5px] text-danger">{outbox.lastError}</p>
      ) : null}
    </div>
  );
}

function EventCard({ event, isNew, knownIds }: { event: EventTimelineEntry; isNew: boolean; knownIds: ReadonlySet<string> }) {
  const published = event.outbox.status === 'PUBLISHED';

  return (
    <li id={eventAnchor(event.id)} className="relative scroll-mt-24">
      <span
        className={cn(
          'absolute -left-[23px] top-4 size-3 rounded-full border-2 border-card',
          published ? 'bg-success' : 'bg-warning',
        )}
        aria-hidden="true"
      />
      <article className={cn('flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3 sm:px-4', isNew && 'motion-safe:animate-live-new')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="break-all font-mono text-[13.5px] font-bold text-ink">{event.type}</h3>
          <time dateTime={event.occurredAt} className="font-mono text-xs tabular-nums text-muted-ink">
            {formatTimeWithMillis(event.occurredAt)}
          </time>
        </div>

        <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-ink">
          <span>
            mensagem{' '}
            <code className="font-mono text-ink-soft" title={event.id}>
              {shortId(event.id)}
            </code>
          </span>
          {event.causationId ? (
            <span>
              · causado por{' '}
              {knownIds.has(event.causationId) ? (
                <a
                  href={`#${eventAnchor(event.causationId)}`}
                  title={event.causationId}
                  className="font-mono font-bold text-brand transition-colors duration-150 hover:text-brand-link"
                >
                  {shortId(event.causationId)}
                </a>
              ) : (
                <code className="font-mono text-ink-soft" title={event.causationId}>
                  {shortId(event.causationId)}
                </code>
              )}
            </span>
          ) : null}
        </p>

        <OutboxLine event={event} />

        {event.consumers.length > 0 ? (
          <ul className="flex flex-col gap-1.5 border-t border-line pt-2" aria-label="Consumidores">
            {event.consumers.map((consumer) => (
              <ConsumerRow key={consumer.name} consumer={consumer} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-line pt-2 text-[12.5px] text-muted-ink">Nenhum consumidor assina este evento.</p>
        )}

        <details>
          <summary className="cursor-pointer text-xs font-bold text-muted-ink transition-colors duration-150 hover:text-ink">
            Payload e metadata
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-surface p-3 font-mono text-[11.5px] leading-[1.5] text-ink-soft">
            {JSON.stringify({ payload: event.payload, metadata: event.metadata }, null, 2)}
          </pre>
        </details>
      </article>
    </li>
  );
}

function EventsCard({ events, newEventIds }: { events: readonly EventTimelineEntry[]; newEventIds: ReadonlySet<string> }) {
  const correlation = correlationOf(events);
  const knownIds = new Set(events.map((event) => event.id));

  return (
    <section className={CARD_CLASS}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={CARD_TITLE_CLASS}>Eventos</h2>
        <p className="text-xs text-muted-ink">
          {correlation ? (
            <>
              correlação{' '}
              <code className="font-mono font-bold text-ink-soft" title={correlation}>
                {shortId(correlation)}
              </code>
              {' · '}
            </>
          ) : null}
          {events.length} {events.length === 1 ? 'evento' : 'eventos'}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl bg-surface px-3.5 py-3 text-[13px] text-muted-ink">Nenhum evento gravado para este pedido.</p>
      ) : (
        <ol className="ml-2 flex flex-col gap-3 border-l-2 border-line pl-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} isNew={newEventIds.has(event.id)} knownIds={knownIds} />
          ))}
        </ol>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs leading-[1.5] text-muted-ink">
        Atualizado pelos eventos que chegam do RabbitMQ. Falhas e descartes: painel do RabbitMQ ou{' '}
        <code className="font-mono text-ink-soft">jaja broker:queues</code>.
      </p>
    </section>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

type OrderMonitorProps = {
  orderId: string;
  /** Query string da lista de origem (página, status e busca), mantida no "← Pedidos". */
  returnQuery?: string;
};

/**
 * Painel do pedido no admin (`/admin/orders/:id`), a "janela" para o fluxo
 * orientado a eventos, atualizado ao vivo:
 * - cabeçalho: "← Pedidos" (mantém os filtros da lista), "Pedido #número" com o
 *   badge do status e o indicador ao vivo, "Feito às HH:MM:SS · há X" e, entregue,
 *   "Entregue em Y";
 * - à esquerda: "Progresso" (passos com horário e duração desde o anterior, o
 *   atual "Em andamento…" e os demais "Aguardando"), "Cliente e entrega" e "Itens";
 * - à direita: "Eventos", a linha do tempo técnica (outbox, publicação,
 *   consumidores com contagem regressiva, causa e correlação, payload e metadata).
 *
 * `useAdminOrder` relê pedido e eventos a cada aviso deste pedido no stream
 * administrativo e a cada reconexão; eventos novos entram com destaque breve (sem
 * animação com `prefers-reduced-motion`). Uma coluna no mobile, na ordem acima.
 */
export function OrderMonitor({ orderId, returnQuery }: OrderMonitorProps) {
  const { status: liveStatus } = useOrdersLive();
  const { order, events, loading, notFound, newEventIds } = useAdminOrder(orderId);
  const backHref = ordersRoute(returnQuery);

  if (loading) return <MonitorSkeleton />;
  if (notFound) return <MonitorNotice emoji="🔎" title="Pedido não encontrado." backHref={backHref} />;
  // Erro diferente de "não encontrado": a mensagem já apareceu no toaster.
  if (!order) return <MonitorNotice emoji="🔌" title="Não foi possível carregar o pedido." backHref={backHref} />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <Link
          href={backHref}
          className="w-fit text-[13px] font-bold text-brand transition-colors duration-150 hover:text-brand-link"
        >
          ← Pedidos
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[26px] font-extrabold tracking-[-0.6px] text-ink">Pedido #{formatOrderNumber(order.id)}</h1>
          <OrderStatusBadge status={order.status} className="px-3.5 py-1.5 text-[13px]" />
          <LiveIndicator status={liveStatus} />
        </div>
        <PlacedLine order={order} />
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <ProgressCard order={order} />
          <CustomerCard order={order} />
          <ItemsCard order={order} />
        </div>
        <EventsCard events={events} newEventIds={newEventIds} />
      </div>
    </div>
  );
}
