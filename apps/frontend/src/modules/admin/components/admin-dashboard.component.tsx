'use client';

import { useClientMinute } from '@/shared/hooks/use-client-clock.hook';
import Link from 'next/link';
import { useAuth } from '@/modules/auth/data/auth.context';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { MetricCard } from '@/shared/components/ui/metric-card';
import { CATALOG_ROUTE } from '@/shared/navigation/catalog-routes';
import { ORDERS_ROUTE } from '@/shared/navigation/orders-routes';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { cn } from '@/shared/lib/class-name.util';
import {
  COURIERS_ONLINE,
  DASHBOARD_KPIS,
  DELIVERY_TARGET_MINUTES,
  HOURLY_BARS,
  LOW_STOCK_PRODUCTS,
  ONGOING_ORDERS,
} from '../data';
import { OrderStatusBadge, CourierCell } from './order-status.component';

const CARD_CLASS = 'rounded-2xl border border-line bg-card px-[22px] py-5';
const MAX_BAR_MINUTES = 45;

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Data e saudação dependem do relógio do cliente: entram após a hidratação.
function useTodayLabel(): { greeting: string; date: string } | null {
  const minute = useClientMinute();
  if (minute === null) return null;
  const now = new Date(minute);
  const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return { greeting: greetingFor(now.getHours()), date: date.charAt(0).toUpperCase() + date.slice(1) };
}

function CardTitleRow({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h2 className="font-display text-[17px] font-extrabold">{title}</h2>
      {action ? (
        <Link href={action.href} className="text-[13px] font-bold text-brand transition-colors duration-150 hover:text-brand-link">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

function OngoingOrdersCard() {
  return (
    <section className={CARD_CLASS}>
      <CardTitleRow title="Pedidos em andamento" action={{ label: 'Ver todos', href: ORDERS_ROUTE }} />
      <div className="overflow-x-auto">
        <div className="grid min-w-[480px] grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 gap-y-2.5 text-[13.5px]">
          {['Pedido', 'Destino', 'Entregador', 'Status', 'ETA'].map((label, index) => (
            <span key={label} className={cn('text-xs font-extrabold uppercase tracking-[0.04em] text-muted-ink', index === 4 && 'text-right')}>
              {label}
            </span>
          ))}
          {ONGOING_ORDERS.map((order) => (
            <OrderRowFragment key={order.id} order={order} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OrderRowFragment({ order }: { order: (typeof ONGOING_ORDERS)[number] }) {
  return (
    <>
      <span className="font-extrabold">#{order.id}</span>
      <span className="min-w-0 truncate">
        {order.destination}
        <span className="text-muted-ink"> · {order.itemsLabel}</span>
      </span>
      <CourierCell mode={order.mode} name={order.courier} />
      <OrderStatusBadge status={order.status} />
      <span className={cn('text-right font-extrabold', order.late ? 'text-danger' : 'text-ink')}>{order.etaLabel}</span>
    </>
  );
}

// No desktop o cartão estica até a altura de "Pedidos em andamento" e as barras
// ocupam o espaço livre; abaixo disso mantém a altura fixa de 120px.
function HourlyChartCard() {
  return (
    <section className={cn(CARD_CLASS, 'flex flex-col')}>
      <h2 className="mb-1 font-display text-[17px] font-extrabold">Tempo médio por hora</h2>
      <p className="mb-3.5 text-[12.5px] text-muted-ink">Meta: até {DELIVERY_TARGET_MINUTES} min por entrega</p>
      <div
        className="flex h-[120px] items-end gap-2 xl:h-auto xl:min-h-[120px] xl:flex-1"
        role="img"
        aria-label="Tempo médio de entrega por hora do dia"
      >
        {HOURLY_BARS.map((bar) => {
          const overTarget = bar.minutes > DELIVERY_TARGET_MINUTES;
          return (
            <div key={bar.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={cn('text-[10.5px] font-extrabold', overTarget ? 'text-danger' : 'text-muted-ink')}>{bar.minutes}&#8242;</span>
              <span
                className={cn('w-full rounded-t-[7px] rounded-b-[3px]', overTarget ? 'bg-brand-light/70' : 'bg-brand')}
                style={{ height: `${Math.round((bar.minutes / MAX_BAR_MINUTES) * 100)}%` }}
              />
              <span className="text-[10.5px] font-bold text-muted-ink">{bar.hour}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LowStockCard() {
  return (
    <section className={CARD_CLASS}>
      <CardTitleRow title="Estoque baixo" action={{ label: 'Repor estoque', href: CATALOG_ROUTE }} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LOW_STOCK_PRODUCTS.map((product) => {
          const ratio = product.stock / product.capacity;
          const critical = ratio < 0.2;
          return (
            <div key={product.slug} className="flex items-center gap-[11px] rounded-xl border border-line px-[15px] py-[13px]">
              <ProductArt emoji={product.emoji} category={product.category} size="xs" className="size-10 rounded-[10px] text-[20px]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-extrabold">{product.name}</div>
                <div className="mt-[7px] h-1.5 overflow-hidden rounded-pill bg-surface" aria-hidden="true">
                  <span className={cn('block h-full rounded-pill', critical ? 'bg-danger' : 'bg-warning')} style={{ width: `${Math.round(ratio * 100)}%` }} />
                </div>
              </div>
              <span className={cn('whitespace-nowrap text-xs font-extrabold', critical ? 'text-danger' : 'text-warning')}>{product.stock} un</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Dashboard da operação: saudação, KPIs, pedidos em andamento, tempo por hora e estoque baixo. */
export function AdminDashboardComponent() {
  const { user } = useAuth();
  const today = useTodayLabel();

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-0.6px]">
            {today?.greeting ?? 'Olá'}, {user ? firstNameOf(user.name) : 'operação'} 👋
          </h1>
          <p className="mt-0.5 text-[13.5px] text-muted-ink">
            {today ? `${today.date} · ` : ''}
            Operação normal
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="success" className="px-4 py-[9px] text-[13px]">
            <span className="size-2 rounded-full bg-success animate-pulse-soft" aria-hidden="true" />
            {COURIERS_ONLINE} entregadores online
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={STOREFRONT_ROUTE}>Ver loja →</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_KPIS.map((kpi) => (
          <MetricCard
            key={kpi.id}
            title={kpi.label}
            value={kpi.value}
            subtitle={kpi.delta}
            deltaTone={kpi.deltaTone}
            icon={kpi.icon}
            iconTintClassName={kpi.tintClassName}
          />
        ))}
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <OngoingOrdersCard />
        <HourlyChartCard />
      </div>

      <LowStockCard />
    </div>
  );
}
