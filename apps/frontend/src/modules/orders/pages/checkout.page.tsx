'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AuthForm } from '@/modules/auth/components/auth-form.component';
import { useAuth } from '@/modules/auth/data/auth.context';
import { welcomeMessage } from '@/modules/auth/pages/storefront-login.page';
import { useStorefront } from '@/modules/catalog/data/use-storefront.hook';
import { CustomerDeliveryForm } from '@/modules/customers/components/customer-delivery-form.component';
import { CustomerDeliverySummary } from '@/modules/customers/components/customer-delivery-summary.component';
import { useMyCustomer } from '@/modules/customers/data/use-my-customer.hook';
import { ProductArt } from '@/shared/components/store/product-art.component';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { STOREFRONT_ROUTE, orderTrackingRoute } from '@/shared/navigation/storefront-routes';
import { withQuery } from '@/shared/navigation/with-query.util';
import { useHydrated } from '@/shared/hooks/use-hydrated.hook';
import { cn } from '@/shared/lib/class-name.util';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import { formatPrice } from '@/shared/util/price.util';
import { useCart } from '../data/cart.context';
import { placeMyOrder } from '../data/order.api';
import { ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH, ORDER_RECIPIENT_NAME_MAX_LENGTH, formatOrderNumber } from '../data/order.util';

const CARD_CLASS = 'rounded-3xl border border-line bg-card px-5 py-[22px] sm:px-6';

function StepTitle({ number, children, badge }: { number: number; children: string; badge?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-[30px] items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{number}</span>
      <h2 className="font-display text-lg font-extrabold">{children}</h2>
      {badge}
    </div>
  );
}

// Recusa do pedido por causa do cadastro de cliente (ausente, inativo ou não encontrado).
function isCustomerFailure(error: unknown): boolean {
  return error instanceof ApiError && error.codes.some((code) => code.startsWith('ORDER_CUSTOMER_'));
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

function CheckoutForm() {
  const router = useRouter();
  const { user, session } = useAuth();
  const storefront = useStorefront();
  const cart = useCart();
  const myCustomer = useMyCustomer();
  const [editingDelivery, setEditingDelivery] = useState(false);
  // Dados deste pedido: não são salvos no cadastro de cliente.
  const [recipientName, setRecipientName] = useState(user?.name ?? '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  // "← Voltar para a loja" preserva a query da vitrine (loja e categoria).
  const backHref = withQuery(STOREFRONT_ROUTE, storefront.query);
  const refreshCart = cart.refresh;
  const { detail } = cart;
  const cartReady = !cart.loading && !cart.isSyncing && cart.count > 0 && !cart.hasUnavailableItems;
  // Confirmar exige cadastro de cliente salvo e o formulário de dados de entrega fechado.
  const deliveryReady = myCustomer.hasCustomer && !editingDelivery;
  const canConfirm = cartReady && deliveryReady && !isConfirming;

  // O carrinho da conta pode ter mudado em outro dispositivo: recarrega ao abrir o checkout.
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Cria o pedido na API, que esvazia o carrinho da conta na mesma transação.
  // Sucesso: recarrega o carrinho e vai ao acompanhamento (o botão continua
  // bloqueado até a navegação). Erro: mensagem, resumo recarregado (e o
  // cadastro, quando a recusa é dele) e a página continua aqui.
  const handleConfirm = async () => {
    if (!session) return;
    setIsConfirming(true);

    try {
      const order = await placeMyOrder(session.token, { recipientName, deliveryInstructions });
      cart.refresh();
      toast.success(`Pedido #${formatOrderNumber(order.id)} recebido`, { description: 'Pagamento simulado em andamento.' });
      router.push(orderTrackingRoute(order.id));
    } catch (error) {
      toast.error(toErrorMessage(error));
      cart.refresh();
      if (isCustomerFailure(error)) myCustomer.refresh();
      setIsConfirming(false);
    }
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
                  defaults={{ city: storefront.city ?? '', state: storefront.state ?? '' }}
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
              <Field
                id="receiver"
                label="Quem recebe"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                maxLength={ORDER_RECIPIENT_NAME_MAX_LENGTH}
                autoComplete="name"
              />
              <Field
                id="instructions"
                label="Instruções para o entregador"
                placeholder="Ex.: deixar na recepção do andar, falar com a Ana"
                value={deliveryInstructions}
                onChange={(event) => setDeliveryInstructions(event.target.value)}
                maxLength={ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH}
              />
            </div>
          </section>

          {/* Pagamento */}
          <section className={CARD_CLASS}>
            <StepTitle number={2} badge={<Badge>Simulado</Badge>}>
              Pagamento
            </StepTitle>
            {/* Nenhum dado de pagamento é pedido: o pagamento é simulado depois da confirmação. */}
            <p className="rounded-xl bg-surface px-[18px] py-4 text-[13.5px] leading-[1.55] text-ink-soft">
              Não pedimos nenhum dado de pagamento: nesta versão ele é simulado e aprovado automaticamente depois que você
              confirma o pedido.
            </p>
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

          <Button size="xl" className="mt-[26px] w-full" disabled={!canConfirm} onClick={handleConfirm}>
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
 * sessão, mostra os dados de entrega do cliente, quem recebe e as instruções
 * para o entregador, o pagamento simulado (sem nenhum dado de pagamento) e o
 * resumo do carrinho da conta. "Confirmar pedido" cria o pedido na API, que
 * esvazia o carrinho, e leva ao acompanhamento; em erro, a página continua
 * aqui. Nunca redireciona.
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
