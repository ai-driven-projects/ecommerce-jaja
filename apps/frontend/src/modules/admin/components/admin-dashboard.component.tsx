'use client';

import type { ReactNode } from 'react';
import { useClientMinute } from '@/shared/hooks/use-client-clock.hook';
import Link from 'next/link';
import { useAuth } from '@/modules/auth/data/auth.context';
import { LiveIndicator } from '@/modules/orders/components/live-indicator.component';
import { OrderListTable } from '@/modules/orders/components/order-list-table.component';
import type { OrdersSummary } from '@/modules/orders/data/admin-order.api';
import { useOrdersLive } from '@/modules/orders/data/orders-live.context';
import { useOrdersSummary } from '@/modules/orders/data/use-orders-summary.hook';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { MetricCard } from '@/shared/components/ui/metric-card';
import { CATALOG_ROUTE } from '@/shared/navigation/catalog-routes';
import { ORDERS_ROUTE } from '@/shared/navigation/orders-routes';
import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import { COURIERS_ONLINE, LOW_STOCK_PRODUCTS } from '../data';

const CARD_CLASS = 'rounded-2xl border border-line bg-card px-[22px] py-5';

/** Valor dos indicadores enquanto o resumo não chegou. */
const LOADING_VALUE = '…';

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

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

function CardTitleRow({ title, aside, action }: { title: string; aside?: ReactNode; action?: { label: string; href: string } }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-display text-[17px] font-extrabold">{title}</h2>
        {aside}
      </div>
      {action ? (
        <Link href={action.href} className="text-[13px] font-bold text-brand transition-colors duration-150 hover:text-brand-link">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

/**
 * "Tempo até a entrega" (média de hoje, com uma casa): "X min", "Y s" abaixo de
 * 1 min, ou "—" sem entregas hoje.
 */
function formatAverageDelivery(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  return `${decimal.format(minutes)} min`;
}

// Os quatro indicadores do dia, do resumo de pedidos (relido ao vivo).
function SummaryKpis({ summary }: { summary: OrdersSummary | null }) {
  const delivered = summary ? `${summary.deliveredToday} ${summary.deliveredToday === 1 ? 'entregue' : 'entregues'}` : LOADING_VALUE;

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Pedidos hoje"
        value={summary ? summary.placedToday : LOADING_VALUE}
        subtitle={delivered}
        deltaTone="success"
        icon="📦"
        iconTintClassName="bg-tint-peach"
      />
      <MetricCard
        title="Em andamento"
        value={summary ? summary.inProgress : LOADING_VALUE}
        icon="🚴"
        iconTintClassName="bg-tint-mint"
      />
      <MetricCard
        title="Ticket médio hoje"
        value={summary ? (summary.averageTicketTodayCents === null ? '—' : formatPrice(summary.averageTicketTodayCents)) : LOADING_VALUE}
        icon="🧾"
        iconTintClassName="bg-tint-blue"
      />
      <MetricCard
        title="Tempo até a entrega"
        value={summary ? formatAverageDelivery(summary.averageDeliveryMinutesToday) : LOADING_VALUE}
        icon="⏱️"
        iconTintClassName="bg-tint-green"
      />
    </div>
  );
}

// Últimos pedidos em andamento (até 6), ao vivo; a linha leva ao painel do pedido.
function OngoingOrdersCard({ summary }: { summary: OrdersSummary | null }) {
  const { status } = useOrdersLive();

  return (
    <section className={CARD_CLASS}>
      <CardTitleRow title="Pedidos em andamento" aside={<LiveIndicator status={status} />} action={{ label: 'Ver todos', href: ORDERS_ROUTE }} />
      {summary === null ? (
        <div className="flex flex-col gap-2.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-9 rounded-lg bg-surface" />
          ))}
        </div>
      ) : summary.latestInProgress.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-6 text-center text-[13.5px] font-bold text-muted-ink">Nenhum pedido em andamento agora.</p>
      ) : (
        <div className="-mx-3">
          <OrderListTable orders={summary.latestInProgress} />
        </div>
      )}
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

/**
 * Dashboard da operação: saudação, os indicadores do dia e "Pedidos em
 * andamento" (do resumo de pedidos da API, relido ao vivo pelo stream
 * administrativo), entregadores online e "Estoque baixo" (dados locais de exemplo).
 */
export function AdminDashboardComponent() {
  const { user } = useAuth();
  const today = useTodayLabel();
  const { summary } = useOrdersSummary();

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

      <SummaryKpis summary={summary} />

      <OngoingOrdersCard summary={summary} />

      <LowStockCard />
    </div>
  );
}
