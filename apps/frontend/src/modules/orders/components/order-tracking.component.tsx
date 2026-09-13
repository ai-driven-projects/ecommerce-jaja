'use client';

import { useClientMinute } from '@/shared/hooks/use-client-clock.hook';
import { MessageCircle, Phone } from 'lucide-react';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import { buildTrackingOrder, type TrackingOrder, type TrackingStep } from '../data/tracking.mock';

// Mapa ilustrativo: quarteirões claros sobre verde-acinzentado, rota laranja
// pontilhada do hub (ponto escuro) até o cliente (ponto laranja pulsando).
function RouteMap({ order }: { order: TrackingOrder }) {
  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl bg-map lg:h-[520px]">
      <svg width="100%" height="100%" viewBox="0 0 480 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="480" height="520" fill="#E9EFE9" />
        <g stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round">
          <line x1="0" y1="110" x2="480" y2="110" />
          <line x1="0" y1="250" x2="480" y2="250" />
          <line x1="0" y1="400" x2="480" y2="400" />
          <line x1="90" y1="0" x2="90" y2="520" />
          <line x1="240" y1="0" x2="240" y2="520" />
          <line x1="390" y1="0" x2="390" y2="520" />
        </g>
        <g stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity=".8">
          <line x1="0" y1="180" x2="480" y2="180" />
          <line x1="0" y1="330" x2="480" y2="330" />
          <line x1="165" y1="0" x2="165" y2="520" />
          <line x1="315" y1="0" x2="315" y2="520" />
        </g>
        <path d="M90 400 L240 400 L240 250 L390 250 L390 110" fill="none" stroke="#FF6B00" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 12" />
        <circle cx="90" cy="400" r="10" fill="#1E1812" />
        <circle cx="390" cy="110" r="14" fill="#FF6B00" />
        <circle cx="390" cy="110" r="24" fill="#FF6B00" opacity=".2">
          <animate attributeName="r" values="16;30;16" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="absolute bottom-[88px] left-3.5 rounded-xl bg-card px-[13px] py-2 text-[12.5px] font-extrabold shadow-float">🏬 {order.hub}</div>
      <div className="absolute right-3.5 top-16 max-w-[60%] truncate rounded-xl bg-card px-[13px] py-2 text-[12.5px] font-extrabold shadow-float">📍 Você · {order.address.split(' · ')[0]}</div>
      <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-pill bg-card px-4 py-[9px] text-[13px] font-extrabold shadow-float">
        🚴 {order.courier.name.split(' ')[0]} <span className="text-success">{order.courier.distanceLabel}</span>
      </div>
      <div className="absolute inset-x-3.5 bottom-3.5 flex items-center gap-[11px] rounded-xl bg-card px-4 py-[13px] shadow-float">
        <BikeIcon className="size-5 shrink-0 text-success" strokeWidth={2} />
        <span className="flex-1 truncate text-[13.5px] font-bold">
          {order.courier.name.split(' ')[0]} {order.courier.streetLabel}
        </span>
        <Badge variant="success">~{order.remainingMinutes} min</Badge>
      </div>
    </div>
  );
}

function TimelineStep({ step, isLast }: { step: TrackingStep; isLast: boolean }) {
  const done = step.status === 'done';
  const todo = step.status === 'todo';

  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold text-white',
            done ? 'border-success bg-success' : todo ? 'border-line bg-card' : 'border-success bg-card',
          )}
          aria-hidden="true"
        >
          {done ? '✓' : step.status === 'now' ? <span className="size-2.5 rounded-full bg-success animate-pulse-soft" /> : null}
        </span>
        {!isLast ? <span className={cn('w-0.5 min-h-[26px] flex-1', done ? 'bg-success' : 'bg-line')} aria-hidden="true" /> : null}
      </div>
      <div className="pb-[18px]">
        <div className={cn('text-[14.5px] font-extrabold', todo ? 'text-placeholder' : 'text-ink')}>{step.title}</div>
        <div className="mt-0.5 text-[12.5px] text-muted-ink">{step.detail}</div>
      </div>
    </div>
  );
}

const CARD_CLASS = 'rounded-3xl border border-line bg-card px-6 py-5';

/** Acompanhamento do pedido: status, ETA, linha do tempo, entregador, itens e mapa. */
export function OrderTracking({ orderId }: { orderId: string }) {
  // Horários relativos a "agora" só existem no cliente: o servidor renderiza
  // a estrutura e os textos entram depois da hidratação, sem divergência.
  const minute = useClientMinute();
  const order: TrackingOrder | null = minute === null ? null : buildTrackingOrder(orderId, new Date(minute));

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 pb-12 pt-[26px] sm:px-6">
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[30px] font-extrabold tracking-[-0.8px]">Pedido #{orderId}</h1>
        <Badge variant="success" className="px-3.5 py-1.5 text-[13px]">
          <span className="size-2 rounded-full bg-success animate-pulse-soft" aria-hidden="true" />
          {order?.statusLabel ?? 'A caminho'}
        </Badge>
      </div>
      <p className="mb-[22px] text-sm text-muted-ink">
        {order ? `${order.confirmedAtLabel} · ${order.address}` : 'Carregando o pedido…'}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <section className="flex items-center gap-4 rounded-3xl bg-dark px-6 py-[22px] text-white">
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-dark-surface">
              <BikeIcon className="size-7 text-success-light" strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-[13px] font-bold text-dark-muted">Previsão de chegada</div>
              <div className="font-display text-[24px] font-extrabold tracking-[-0.5px] sm:text-[28px]">
                {order?.etaWindow ?? '--:-- – --:--'}{' '}
                <span className="text-base text-success-light">· faltam ~{order?.remainingMinutes ?? '--'} min</span>
              </div>
            </div>
          </section>

          <section className={CARD_CLASS}>
            <h2 className="mb-4 font-display text-[17px] font-extrabold">Status do pedido</h2>
            <div className="flex flex-col">
              {(order?.steps ?? []).map((step, index, steps) => (
                <TimelineStep key={step.title} step={step} isLast={index === steps.length - 1} />
              ))}
            </div>
          </section>

          {order ? (
            <section className={cn(CARD_CLASS, 'flex items-center gap-3.5')}>
              <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[26px]" aria-hidden="true">
                🚴
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold">{order.courier.name}</div>
                <div className="truncate text-[12.5px] text-muted-ink">
                  {order.courier.mode} · {order.courier.deliveries.toLocaleString('pt-BR')} entregas · ★ {order.courier.rating}
                </div>
              </div>
              <button
                type="button"
                aria-label="Enviar mensagem ao entregador"
                className="flex size-[42px] items-center justify-center rounded-full border border-line bg-card transition-colors duration-150 hover:bg-surface"
              >
                <MessageCircle className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Ligar para o entregador"
                className="flex size-[42px] items-center justify-center rounded-full bg-success text-white transition-colors duration-150 hover:bg-success-strong"
              >
                <Phone className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              </button>
            </section>
          ) : null}

          {order ? (
            <section className={CARD_CLASS}>
              <h2 className="mb-3 font-display text-[17px] font-extrabold">Itens do pedido</h2>
              <div className="flex flex-col gap-2.5 text-[13.5px]">
                {order.items.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <ProductArt emoji={item.emoji} category={item.category} size="xs" />
                    <span className="flex-1 font-bold">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-extrabold">{formatPrice(item.totalCents)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-dashed border-line pt-2.5 text-[15px] font-extrabold">
                  <span>{order.paymentLabel}</span>
                  <span>{formatPrice(order.totalCents)}</span>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {order ? (
          <section className="rounded-3xl border border-line bg-card p-4 lg:sticky lg:top-5">
            <RouteMap order={order} />
          </section>
        ) : (
          <div className="h-[420px] rounded-3xl border border-line bg-card p-4 lg:h-[552px]">
            <div className="h-full rounded-xl bg-map" />
          </div>
        )}
      </div>
    </main>
  );
}
