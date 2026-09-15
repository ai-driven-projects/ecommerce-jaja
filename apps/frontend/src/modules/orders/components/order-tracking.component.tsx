'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, UserRound } from 'lucide-react';
import { useAuth } from '@/modules/auth/data/auth.context';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useClientMinute } from '@/shared/hooks/use-client-clock.hook';
import { useHydrated } from '@/shared/hooks/use-hydrated.hook';
import { STOREFRONT_LOGIN_ROUTE, STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import type { OrderDetail } from '../data/order.api';
import { formatOrderAddress, formatOrderNumber, formatOrderPlacedAt, formatOrderTime } from '../data/order.util';
import { useMyOrder } from '../data/use-my-order.hook';

const MAIN_CLASS = 'mx-auto w-full max-w-[1080px] px-4 pb-12 pt-[26px] sm:px-6';
const CARD_CLASS = 'rounded-3xl border border-line bg-card px-5 py-5 sm:px-6';

/**
 * Categoria passada ao `ProductArt` dos itens: o item do pedido não tem
 * categoria, e a chave vazia não tem ilustração própria em `category-art`, então
 * a reserva é a padrão (🛒 sobre `--tint-green`).
 */
const ORDER_ITEM_ART_CATEGORY = '';

/** Passos do pedido, na ordem. Com o status `PLACED`, só o primeiro está concluído. */
const ORDER_STEPS = ['Pedido recebido', 'Pagamento aprovado', 'Separando na loja', 'A caminho', 'Entregue'] as const;

function TimelineStep({ title, detail, done, isLast }: { title: string; detail: string; done: boolean; isLast: boolean }) {
  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold text-white',
            done ? 'border-success bg-success' : 'border-line bg-card',
          )}
          aria-hidden="true"
        >
          {done ? '✓' : null}
        </span>
        {!isLast ? <span className={cn('min-h-[26px] w-0.5 flex-1', done ? 'bg-success' : 'bg-line')} aria-hidden="true" /> : null}
      </div>
      <div className="pb-[18px]">
        <div className={cn('text-[14.5px] font-extrabold', done ? 'text-ink' : 'text-placeholder')}>{title}</div>
        <div className="mt-0.5 text-[12.5px] text-muted-ink">{detail}</div>
      </div>
    </li>
  );
}

// Estrutura estática (sem shimmer) até a sessão ser conhecida e durante a primeira carga, sem dados de pedido.
function TrackingSkeleton() {
  return (
    <main className={MAIN_CLASS}>
      <div role="status">
        <span className="sr-only">Carregando o pedido…</span>
        <div aria-hidden="true">
          <div className="mb-2.5 h-9 w-72 max-w-full rounded-md bg-surface" />
          <div className="mb-2 h-4 w-44 max-w-full rounded-md bg-surface" />
          <div className="mb-[22px] h-4 w-96 max-w-full rounded-md bg-surface" />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className={CARD_CLASS}>
              <div className="mb-5 h-5 w-40 rounded-md bg-surface" />
              <div className="flex flex-col gap-5">
                {ORDER_STEPS.map((step) => (
                  <div key={step} className="flex items-center gap-3.5">
                    <div className="size-[26px] shrink-0 rounded-full bg-surface" />
                    <div className="h-4 w-36 rounded-md bg-surface" />
                  </div>
                ))}
              </div>
            </div>
            <div className={CARD_CLASS}>
              <div className="mb-4 h-5 w-36 rounded-md bg-surface" />
              <div className="flex flex-col gap-3">
                {[0, 1].map((index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <div className="size-[38px] shrink-0 rounded-[10px] bg-surface" />
                    <div className="h-4 flex-1 rounded-md bg-surface" />
                    <div className="h-4 w-14 rounded-md bg-surface" />
                  </div>
                ))}
              </div>
              <div className="mt-4 h-20 rounded-xl bg-surface" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Aviso centralizado da página (sem sessão, não encontrado ou erro de carga).
function TrackingNotice({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <main className={MAIN_CLASS}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-line bg-card px-6 py-12 text-center">
        <span className="text-[40px] leading-none" aria-hidden="true">
          {emoji}
        </span>
        <h1 className="mt-2 font-display text-xl font-extrabold tracking-[-0.3px]">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function BackToStoreButton() {
  return (
    <Button asChild variant="outline" size="sm" className="mt-2">
      <Link href={STOREFRONT_ROUTE}>Voltar para a loja</Link>
    </Button>
  );
}

function OrderView({ order }: { order: OrderDetail }) {
  // Só é exibido depois da hidratação: horários no fuso do navegador, sem divergir do HTML do servidor.
  const minute = useClientMinute();
  const placedAtLabel = minute === null ? '…' : formatOrderPlacedAt(order.placedAt, new Date(minute));
  const placedTime = minute === null ? '…' : formatOrderTime(order.placedAt);

  return (
    <main className={MAIN_CLASS}>
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[30px] font-extrabold tracking-[-0.8px]">Pedido #{formatOrderNumber(order.id)}</h1>
        <Badge variant="success" className="px-3.5 py-1.5 text-[13px]">
          Pedido recebido
        </Badge>
      </div>
      <p className="text-sm text-muted-ink">{placedAtLabel}</p>
      <div className="mb-[22px] mt-2.5 flex flex-col gap-1.5 text-[13.5px] leading-[1.5]">
        <p className="flex items-start gap-2 font-bold text-ink">
          <MapPin className="mt-[2px] size-4 shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <span className="min-w-0 break-words">{formatOrderAddress(order.deliveryAddress)}</span>
        </p>
        <p className="flex items-start gap-2 text-ink-soft">
          <UserRound className="mt-[2px] size-4 shrink-0 text-muted-ink" strokeWidth={2.2} aria-hidden="true" />
          <span className="min-w-0 break-words">
            Quem recebe: <strong className="text-ink">{order.recipientName}</strong>
          </span>
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className={CARD_CLASS}>
          <h2 className="mb-4 font-display text-[17px] font-extrabold">Status do pedido</h2>
          <ol className="flex flex-col">
            {ORDER_STEPS.map((step, index) => {
              // Nesta versão todo pedido está em `PLACED`: só "Pedido recebido" está concluído.
              const done = index === 0;
              return (
                <TimelineStep
                  key={step}
                  title={step}
                  detail={done ? placedTime : 'Aguardando'}
                  done={done}
                  isLast={index === ORDER_STEPS.length - 1}
                />
              );
            })}
          </ol>
        </section>

        <div className="flex flex-col gap-4 lg:sticky lg:top-5">
          <section className={CARD_CLASS}>
            <h2 className="mb-3 font-display text-[17px] font-extrabold">Itens do pedido</h2>
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
                <span>Entrega de bike</span>
                {order.deliveryFeeCents === 0 ? (
                  <span className="font-extrabold text-success">Grátis</span>
                ) : (
                  <span className="font-bold tabular-nums text-ink">{formatPrice(order.deliveryFeeCents)}</span>
                )}
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <span className="flex flex-col text-[17px] font-extrabold">
                  Total
                  <span className="text-xs font-bold text-muted-ink">Pagamento simulado</span>
                </span>
                <span className="text-[17px] font-extrabold tabular-nums">{formatPrice(order.totalCents)}</span>
              </div>
            </div>
          </section>

          {order.deliveryInstructions ? (
            <section className={CARD_CLASS}>
              <h2 className="mb-2 font-display text-[17px] font-extrabold">Instruções para o entregador</h2>
              <p className="whitespace-pre-line break-words text-[13.5px] leading-[1.55] text-ink-soft">{order.deliveryInstructions}</p>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/**
 * Acompanhamento do pedido real do cliente autenticado: cabeçalho com número,
 * badge, horário, endereço copiado e quem recebe; passos do pedido (só "Pedido
 * recebido" concluído); itens, totais gravados e instruções. Sem sessão, pede
 * para entrar e volta a esta rota; pedido inexistente ou de outra conta mostra
 * "Pedido não encontrado.". Mapa, entregador e previsão de chegada voltam com
 * o fluxo de entrega.
 */
export function OrderTracking({ orderId }: { orderId: string }) {
  // A sessão só é conhecida no cliente: até hidratar, o servidor e o cliente
  // renderizam a mesma estrutura de carregamento.
  const hydrated = useHydrated();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { order, loading, notFound } = useMyOrder(orderId);

  if (!hydrated || loading) return <TrackingSkeleton />;

  if (!isAuthenticated) {
    const signInHref = `${STOREFRONT_LOGIN_ROUTE}?voltar=${encodeURIComponent(pathname)}`;
    return (
      <TrackingNotice emoji="🔒" title="Entre para acompanhar seu pedido.">
        <Button asChild size="sm" className="mt-2">
          <Link href={signInHref}>Entrar</Link>
        </Button>
      </TrackingNotice>
    );
  }

  if (notFound) {
    return (
      <TrackingNotice emoji="🔎" title="Pedido não encontrado.">
        <BackToStoreButton />
      </TrackingNotice>
    );
  }

  // Erro diferente de "não encontrado": a mensagem já apareceu no toaster.
  if (!order) {
    return (
      <TrackingNotice emoji="🔌" title="Não foi possível carregar o pedido.">
        <BackToStoreButton />
      </TrackingNotice>
    );
  }

  return <OrderView order={order} />;
}
