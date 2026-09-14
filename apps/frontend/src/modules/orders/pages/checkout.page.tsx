'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthForm } from '@/modules/auth/components/auth-form.component';
import { useAuth } from '@/modules/auth/data/auth.context';
import { welcomeMessage } from '@/modules/auth/pages/storefront-login.page';
import { useStorefront } from '@/modules/catalog/data/use-storefront.hook';
import { CustomerDeliveryForm } from '@/modules/customers/components/customer-delivery-form.component';
import { CustomerDeliverySummary } from '@/modules/customers/components/customer-delivery-summary.component';
import { useMyCustomer } from '@/modules/customers/data/use-my-customer.hook';
import { BikeIcon } from '@/shared/components/branding/app-logo.component';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { STOREFRONT_ROUTE, orderTrackingRoute } from '@/shared/navigation/storefront-routes';
import { useClientMinute } from '@/shared/hooks/use-client-clock.hook';
import { useHydrated } from '@/shared/hooks/use-hydrated.hook';
import { cn } from '@/shared/lib/class-name.util';
import { formatPrice } from '@/shared/util/price.util';
import { useCart } from '../data/cart.context';
import { nextOrderId } from '../data/tracking.mock';

type PaymentMethod = 'pix' | 'card' | 'corp';

const PAYMENT_METHODS: ReadonlyArray<{ id: PaymentMethod; icon: string; label: string }> = [
  { id: 'pix', icon: '⚡', label: 'Pix' },
  { id: 'card', icon: '💳', label: 'Cartão' },
  { id: 'corp', icon: '🏢', label: 'Faturado (empresa)' },
];

// Cidade e UF iniciais dos dados de entrega sem cadastro: a loja só atende Fortaleza/CE.
const DELIVERY_CITY = 'Fortaleza';
const DELIVERY_STATE = 'CE';

const CARD_CLASS = 'rounded-3xl border border-line bg-card px-5 py-[22px] sm:px-6';

function StepTitle({ number, children }: { number: number; children: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-[30px] items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{number}</span>
      <h2 className="font-display text-lg font-extrabold">{children}</h2>
    </div>
  );
}

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

// Estrutura estática (sem shimmer) do resumo enquanto o cadastro de cliente é consultado.
function DeliverySkeleton() {
  return (
    <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-surface px-[18px] py-4">
      <span className="sr-only">Carregando dados de entrega…</span>
      <div className="flex flex-1 flex-col gap-2.5" aria-hidden="true">
        <div className="h-4 w-4/5 rounded-md bg-card" />
        <div className="h-4 w-36 rounded-md bg-card" />
      </div>
      <div className="h-9 w-20 rounded-pill bg-card" aria-hidden="true" />
    </div>
  );
}

// Estrutura estática (sem shimmer) das linhas do resumo enquanto o carrinho da conta carrega.
function SummaryLinesSkeleton() {
  return (
    <div role="status" className="mb-4 flex flex-col gap-3">
      <span className="sr-only">Carregando carrinho…</span>
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-[11px]" aria-hidden="true">
          <div className="size-11 shrink-0 rounded-[11px] bg-surface" />
          <div className="h-4 flex-1 rounded-md bg-surface" />
          <div className="h-4 w-14 rounded-md bg-surface" />
        </div>
      ))}
    </div>
  );
}

// Janela de chegada relativa ao ETA do bairro: depende do relógio, então só
// existe no cliente (o servidor renderiza "…").
function useEtaWindow(etaMinutes: number | null): string | null {
  const minute = useClientMinute();
  if (etaMinutes === null || minute === null) return null;
  const format = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${format(new Date(minute + (etaMinutes - 5) * 60000))}–${format(new Date(minute + (etaMinutes + 5) * 60000))}`;
}

function CheckoutForm() {
  const router = useRouter();
  const { user } = useAuth();
  const storefront = useStorefront();
  const cart = useCart();
  const myCustomer = useMyCustomer();
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [isConfirming, setIsConfirming] = useState(false);
  const etaWindow = useEtaWindow(storefront.etaMinutes);
  const backHref = `${STOREFRONT_ROUTE}?${storefront.query}`;
  const refreshCart = cart.refresh;
  const { detail } = cart;
  const cartReady = !cart.loading && !cart.isSyncing && cart.count > 0 && !cart.hasUnavailableItems;
  // Confirmar exige cadastro de cliente salvo e o formulário de dados de entrega fechado.
  const deliveryReady = myCustomer.hasCustomer && !editingDelivery;
  const canConfirm = cartReady && storefront.served && deliveryReady && !isConfirming;

  // O carrinho da conta pode ter mudado em outro dispositivo: recarrega ao abrir o checkout.
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Confirmação simulada: esvazia o carrinho da conta antes de ir ao acompanhamento.
  // Se esvaziar falhar, o carrinho já exibiu o erro e a página continua aqui.
  const handleConfirm = async () => {
    setIsConfirming(true);
    const cleared = await cart.clear();
    if (!cleared) {
      setIsConfirming(false);
      return;
    }

    const orderId = nextOrderId();
    toast.success(`Pedido #${orderId} confirmado`, { description: 'A bike já sai da loja.' });
    router.push(orderTrackingRoute(orderId));
  };

  return (
    <>
      <Link href={backHref} className="text-[13.5px] font-bold text-muted-ink transition-colors duration-150 hover:text-brand">
        ← Voltar para a loja
      </Link>
      <h1 className="mb-[22px] mt-2.5 font-display text-[30px] font-extrabold tracking-[-0.8px]">Finalizar pedido</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {/* Endereço */}
          <section className={CARD_CLASS}>
            <StepTitle number={1}>Endereço de entrega</StepTitle>
            <div
              className={cn(
                'mb-4 flex items-center gap-2.5 rounded-xl px-[15px] py-3 text-[13.5px] font-bold',
                storefront.served ? 'bg-success-soft text-success-strong' : 'bg-danger-soft text-danger',
              )}
            >
              <BikeIcon className="size-4 shrink-0" strokeWidth={2} />
              {storefront.served
                ? `Dentro da área de cobertura · entrega em ~${storefront.etaMinutes} min`
                : `Ainda não entregamos em ${storefront.neighborhood}`}
            </div>

            {/* Dados de entrega do cliente: carregando → criação | resumo ⇄ alteração. */}
            {myCustomer.loading ? (
              <DeliverySkeleton />
            ) : myCustomer.customer === null ? (
              <>
                <p className="mb-4 text-[13.5px] leading-[1.55] text-ink-soft">
                  Precisamos destes dados uma vez só: ficam salvos para os próximos pedidos.
                </p>
                <CustomerDeliveryForm
                  customer={null}
                  defaults={{ neighborhood: storefront.neighborhood, city: DELIVERY_CITY, state: DELIVERY_STATE }}
                  save={myCustomer.save}
                />
              </>
            ) : editingDelivery ? (
              <CustomerDeliveryForm
                customer={myCustomer.customer}
                save={myCustomer.save}
                onSaved={() => setEditingDelivery(false)}
                onCancel={() => setEditingDelivery(false)}
              />
            ) : (
              <CustomerDeliverySummary customer={myCustomer.customer} onEdit={() => setEditingDelivery(true)} />
            )}

            {/* Dados deste pedido: não são salvos no cadastro de cliente. */}
            <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Field id="receiver" label="Quem recebe" defaultValue={user?.name ?? ''} autoComplete="name" />
              <Field id="instructions" label="Instruções para o entregador" placeholder="Ex.: deixar na recepção do andar, falar com a Ana" />
            </div>
          </section>

          {/* Pagamento */}
          <section className={CARD_CLASS}>
            <StepTitle number={2}>Pagamento</StepTitle>
            <div className="mb-4 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Forma de pagamento">
              {PAYMENT_METHODS.map((method) => {
                const isActive = method.id === payment;
                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setPayment(method.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-pill border-[1.5px] px-[18px] py-2.5 text-[13.5px] font-extrabold transition-colors duration-150',
                      isActive ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-card text-ink hover:bg-surface',
                    )}
                  >
                    <span aria-hidden="true">{method.icon}</span> {method.label}
                  </button>
                );
              })}
            </div>

            {payment === 'pix' ? (
              <p className="rounded-xl bg-surface px-[18px] py-4 text-[13.5px] leading-[1.55] text-ink-soft">
                O QR Code Pix é gerado após confirmar o pedido. Pagamento aprovado na hora — a bike já sai da loja. 🚲
              </p>
            ) : null}
            {payment === 'card' ? (
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <Field id="card-number" label="Número do cartão" placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" />
                <Field id="card-expiry" label="Validade" placeholder="MM/AA" autoComplete="cc-exp" />
                <Field id="card-cvv" label="CVV" placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
              </div>
            ) : null}
            {payment === 'corp' ? (
              <p className="rounded-xl bg-surface px-[18px] py-4 text-[13.5px] leading-[1.55] text-ink-soft">
                Faturamento mensal para empresas cadastradas, com nota fiscal consolidada. Este pedido entra na fatura do mês
                da conta de <strong>{user?.name}</strong>.
              </p>
            ) : null}
          </section>
        </div>

        {/* Resumo */}
        <aside className={cn(CARD_CLASS, 'lg:sticky lg:top-5')}>
          <h2 className="mb-3.5 font-display text-lg font-extrabold">Resumo do pedido</h2>

          {cart.loading ? (
            <SummaryLinesSkeleton />
          ) : cart.lines.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3">
              {cart.lines.map((line) => (
                <div key={line.productId} className="flex items-center gap-[11px]">
                  <div className={cn('flex min-w-0 flex-1 items-center gap-[11px]', !line.isAvailable && 'opacity-55')}>
                    <ProductArt
                      category={line.rootCategorySlug}
                      imageUrl={line.thumbUrl}
                      alt={line.name}
                      size="xs"
                      className="size-11 rounded-[11px] text-[22px]"
                    />
                    <div className="min-w-0 flex-1 text-[13.5px] font-bold leading-[1.3]">
                      <span className="line-clamp-2" title={line.name}>
                        {line.name}
                      </span>
                      <span className="font-semibold text-muted-ink">× {line.quantity}</span>
                    </div>
                  </div>
                  {line.isAvailable && line.lineTotalCents !== null ? (
                    <span className="shrink-0 text-[13.5px] font-extrabold tabular-nums">{formatPrice(line.lineTotalCents)}</span>
                  ) : (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant="danger">Indisponível</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Remover ${line.name} do carrinho`}
                        onClick={() => cart.remove(line.productId)}
                      >
                        <Trash2 className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 rounded-xl bg-surface px-4 py-5 text-center text-sm text-muted-ink">
              Seu carrinho está vazio.{' '}
              <Link href={backHref} className="font-bold text-brand">
                Voltar para a loja
              </Link>
            </p>
          )}

          <div
            aria-busy={cart.isSyncing}
            className={cn(
              'flex flex-col gap-[7px] border-t border-dashed border-line pt-3 text-[13.5px] transition-opacity duration-150',
              cart.isSyncing && 'opacity-50',
            )}
          >
            <div className="flex justify-between text-muted-ink">
              <span>Subtotal</span>
              <span className="font-bold tabular-nums text-ink">{formatPrice(detail.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-muted-ink">
              <span>Entrega de bike</span>
              {detail.deliveryFeeCents === 0 ? (
                <span className="font-extrabold text-success">Grátis</span>
              ) : (
                <span className="font-bold tabular-nums text-ink">{formatPrice(detail.deliveryFeeCents)}</span>
              )}
            </div>
            <div className="mt-1 flex justify-between text-[17px] font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(detail.totalCents)}</span>
            </div>
          </div>

          {storefront.served ? (
            <div className="my-3.5 flex items-center gap-2 rounded-xl bg-success-soft px-3.5 py-[11px] text-[13px] font-bold text-success-strong">
              <Clock className="size-[15px] shrink-0 text-success" strokeWidth={2.2} aria-hidden="true" />
              Previsão de chegada: <strong>{etaWindow ?? '…'}</strong>
            </div>
          ) : (
            <div className="my-3.5" />
          )}

          <Button size="xl" className="w-full" disabled={!canConfirm} onClick={handleConfirm}>
            {isConfirming ? 'Confirmando…' : `Confirmar pedido · ${formatPrice(detail.totalCents)}`}
          </Button>
          {!cart.loading && cart.hasUnavailableItems ? (
            <p role="status" className="mt-2.5 text-center text-[13px] font-bold text-danger">
              Remova os itens indisponíveis para confirmar o pedido.
            </p>
          ) : null}
          {/* Só depois de consultar o cadastro, para o aviso não piscar durante o carregamento. */}
          {!myCustomer.loading && !deliveryReady ? (
            <p className="mt-2.5 text-center text-[13px] font-bold text-ink-soft">
              Preencha os dados de entrega para confirmar o pedido.
            </p>
          ) : null}
          <p className="mt-2.5 text-center text-xs text-placeholder">Ao confirmar, você concorda com os termos do já já.</p>
        </aside>
      </div>
    </>
  );
}

// Sem sessão: pede para entrar ou criar conta na mesma URL. Ao autenticar, o
// contexto muda e o formulário de checkout aparece sem redirecionar.
function CheckoutGate() {
  const { user, isAuthenticated } = useAuth();
  const hydrated = useHydrated();

  // A sessão só é conhecida no cliente: até hidratar, mantém o esqueleto.
  if (!hydrated) return <CheckoutSkeleton />;

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 font-display text-[30px] font-extrabold leading-[1.15] tracking-[-0.8px]">
          Para fechar o pedido, entre ou crie sua conta
        </h1>
        <p className="mb-6 text-sm text-muted-ink">Leva menos de um minuto. Seu carrinho continua aqui.</p>
        <div className="rounded-3xl border border-line bg-card p-6">
          <AuthForm onSignedIn={(signedUser, mode) => toast.success(welcomeMessage(signedUser, mode))} />
        </div>
      </div>
    );
  }

  return <CheckoutForm />;
}

// Estrutura estática (sem shimmer) enquanto a query string é lida.
function CheckoutSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-36 rounded-md bg-surface" />
      <div className="mb-[22px] mt-2.5 h-9 w-64 rounded-md bg-surface" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="h-[300px] rounded-3xl border border-line bg-card" />
          <div className="h-[180px] rounded-3xl border border-line bg-card" />
        </div>
        <div className="h-[360px] rounded-3xl border border-line bg-card" />
      </div>
    </div>
  );
}

/**
 * Rota pública `/checkout`: sem sessão pede para entrar ou criar conta e, com
 * sessão, mostra os dados de entrega do cliente, pagamento e o resumo do
 * carrinho. Nunca redireciona.
 */
export function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pb-12 pt-[26px] sm:px-6">
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutGate />
      </Suspense>
    </main>
  );
}
