## Context

A etapa 12 deixou o domínio `order` só com o fechamento: `PlacedOrder(id)` com `number`, `OrderRepository.placeOrder`, `parsePlacedOrder` (lê só o `id` do `201`), `ApiOrderRepository` com `mapOrderFailure` (só traduz `BackendRejectionFailure` com código conhecido; o resto passa como veio) e a rota `/cart/orders/:id` (`AppRoutes.orderSegment`, `orderLocation(id)`, `orders` em `sessionRequiredPaths`), que monta a `OrderPlacedPage` provisória. O `mapHttpFailure` já devolve `NotFoundFailure` para qualquer `404` e `SessionFailure` para `401`, que o `AuthInterceptor` transforma em fim de sessão.

Contrato (só leitura): `MyOrderController.findById` (`GET /me/orders/:id`) responde o `OrderDetailDTO` de `modules/orders/src/order/dto/order.dto.ts`. Pedido ausente, apagado, de outro usuário ou com id malformado respondem `404` com `ORDER_NOT_FOUND`. As datas chegam como texto ISO 8601 em UTC. `ORDER_STATUSES` (`modules/orders/src/order/errors.ts`) define a sequência. Comportamento e textos: `order-tracking.component.tsx`, `order-status.util.ts` (`ORDER_STATUS_LABEL`, `ORDER_STATUS_BADGE_VARIANT`, `ORDER_STEPS`, `orderStepState`, `isOrderFinished`) e `order.util.ts` (`formatOrderAddress`, `formatOrderTime`, `formatOrderTimeWithSeconds`, `formatOrderPlacedAt`).

## Goals / Non-Goals

**Goals:** o pedido completo no domínio, com parsing testado; as regras dos passos em Dart puro; a tela de acompanhamento na rota existente, com puxar para atualizar e os estados de não encontrado e de falha.

**Non-Goals (ficam para outras etapas):**
- SSE (`GET /me/orders/:id/stream`), releitura a cada aviso, indicador "Ao vivo"/"Reconectando…", destaque do passo concluído com a tela aberta, parada em segundo plano e releitura silenciosa (sem skeleton): **etapa 14**. Ela estende o `OrderTrackingViewModel` desta etapa.
- Remoção de código morto, testes finais de DI e rotas, `docs/lacunas-da-api.md`: **etapa 15**.
- Em nenhuma etapa (fora do plano): mapa, entregador, previsão de chegada e "Total pago no Pix" do mockup `Rastreamento.dc.html`, e a lista "Meus pedidos".

## Decisions

### 1. Domínio (`lib/modules/order/model/`)
- `order_entity.dart`, em `freezed`: `OrderDetail(id, status, items, deliveryAddress, recipientName, deliveryInstructions?, itemCount, subtotal, deliveryFee, total, placedAt, paymentApprovedAt?, pickingStartedAt?, outForDeliveryAt?, deliveredAt?)`, `OrderItem(productId, name, unit, thumbUrl?, unitPrice, quantity, lineTotal)` e `OrderDeliveryAddress(zipCode, street, number, complement?, neighborhood, city, state)`, sem `location` (o DTO do pedido não tem). Valores em `Money`, datas em `DateTime` UTC. `customerId` não entra: a tela não usa.
- `order_status.dart`: `enum OrderStatus { placed, paymentApproved, picking, outForDelivery, delivered }`, com `backendCode` e a ordem de `ORDER_STATUSES` (origem num comentário). `fromBackendCode(String)` devolve `null` para código desconhecido.
- `order_progress.dart`: `enum OrderStepState { done, current, pending }`, `orderStepState(OrderStatus status, OrderStatus step)` (cópia de `orderStepState`: até o atual, inclusive, `done`; o seguinte `current` se não entregue; o resto `pending`), `isOrderFinished(OrderStatus)` (`delivered`) e `OrderDetail.dateOf(OrderStatus step)` (o campo da data do passo, como `ORDER_STEPS[].dateKey`).
- `order_number.dart`: `orderNumberOf(String id)`, os 8 primeiros caracteres em maiúsculas. `PlacedOrder.number` e `OrderDetail.number` passam a usá-lo.
- `OrderRepository` ganha `Future<Result<OrderDetail>> findMine(String id)`.

### 2. Infra
- `order_dto.dart` ganha `parseOrderDetail(Object?)`, no molde dos DTOs da etapa 11: objeto obrigatório, textos obrigatórios não vazios onde o DTO não admite `null` (`id`, `name`, `street`…), inteiros não negativos para centavos e quantidades, `status` conhecido, datas por `DateTime.parse` (nulas só nos quatro passos opcionais), `complement`/`thumbUrl`/`deliveryInstructions` aceitando `null`. Fora disso, `FormatException`, que o `runRequest` converte em falha inesperada. `parsePlacedOrder` não muda.
- `ApiOrderRepository.findMine` = `GET /me/orders/<Uri.encodeComponent(id)>` por `runRequest`, passando a falha pelo `mapOrderFailure` (o `404` sai `NotFoundFailure`, sem tradução).

### 3. Formatadores e rótulos (`lib/ui/modules/order/view_models/order_formatters.dart`)
Funções puras, sem `intl` (horas com `padLeft`), que recebem `DateTime` **já local** (a página chama `.toLocal()`), para os testes não dependerem do fuso da máquina: `formatOrderTime` (`HH:MM`), `formatOrderTimeWithSeconds` (`HH:MM:SS`), `formatOrderPlacedAt(placedAt, now)` ("Feito hoje às…"/"Feito em DD/MM/AAAA às…"), `formatOrderAddress(OrderDeliveryAddress)` (complemento aparado e omitido quando vazio, como o web) e `orderStatusLabel(OrderStatus)` com os rótulos de `ORDER_STATUS_LABEL`. Ficam na UI porque são texto de tela, e não no domínio.

### 4. `OrderTrackingViewModel` (`lib/ui/modules/order/view_models/`)
- Recebe `OrderRepository` e um relógio opcional (`DateTime Function() now`, padrão `DateTime.now`). É `registerFactory`, sem caso de uso (um repositório só).
- No molde do `ProductDetailViewModel`: `start(String orderId)` guarda o id e executa `load` (`Command0<void>`), e `order` é `BlockState<OrderDetail>`, `BlockLoading` enquanto `load.running`. O valor vive em campo próprio, e uma geração descarta a resposta de uma leitura anterior.
- `isNotFound` = `BlockFailed` com `NotFoundFailure`. `refresh()` (`Future<void>`, para o `RefreshIndicator`) executa `load` e espera o fim. "Tentar de novo" é o mesmo `load`. `now()` expõe o relógio para "Feito hoje".

### 5. Tela (`lib/ui/modules/order/`)
- `OrderTrackingPage({orderTrackingViewModelFactory, orderId, onBackToStore})`: `Scaffold` com `AppBar` e o voltar implícito (a rota fica sobre `/cart`), `RefreshIndicator` com `ListView` `AlwaysScrollableScrollPhysics` e `switch` exaustivo sobre `order`:
  - carregando: `OrderTrackingSkeleton`;
  - `isNotFound`: `EmptyState` 🔎 "Pedido não encontrado." com "Voltar para a loja" → `onBackToStore`;
  - outra falha: `StateErrorBanner` com o título "Não foi possível carregar o pedido." e "Tentar de novo";
  - carregado: `OrderHeader`, `OrderTimeline`, `OrderItemsCard` e, com instruções, `OrderInstructionsCard`.
- Widgets em `widgets/`: `OrderStatusBadge` (fundo/texto `successSoft`/`success`, `warningSoft`/`warning`, `surface`/`mutedInk`, como o `Badge` do web), `OrderHeader` (título com `number`, selo, "Feito…", linha do endereço e "Quem recebe: <nome>"), `OrderTimeline` com `OrderTimelineStep` (círculo de 26 com ✓ em `success`, atual com borda `brand` sobre `brandSoft` e ponto `brand`, pendente com borda `line`; linha entre passos `success` ou `line`; título `placeholder` no pendente; detalhe `brand` no atual), `OrderItemsCard` (linha com `ProductArt` como a `CheckoutLineTile`, com a arte de reserva por `categoryArtOf` sem categoria, nome, "× n", total; totais em linhas, "Grátis" em `success`, "Total" com "Pagamento simulado") e `OrderInstructionsCard`. O aviso de entregue é um bloco `successSoft` com texto `successStrong`. Só tokens do tema (regra C da barreira).
- Textos como constantes públicas das classes, como nas etapas anteriores (`OrderTrackingPage.notFoundTitle`, `errorTitle`, `backToStoreAction`; `OrderTimeline.title`, `currentDetail`, `pendingDetail`, `deliveredMessage(time)`; `OrderItemsCard.title`, `subtotalLabel`, `deliveryLabel`, `freeLabel`, `totalLabel`, `paymentNote`; `OrderInstructionsCard.title`; `OrderHeader.recipientLabel(name)`).

### 6. Rota e remoção da página provisória
O `builder` de `AppRoutes.orderSegment` passa a montar a `OrderTrackingPage` com `getIt<OrderTrackingViewModel>()`, `state.pathParameters['id']!` e `onBackToStore: () => context.go(AppRoutes.home)`. O caminho, a guarda e o `go` do checkout não mudam. A `OrderPlacedPage` e o teste dela saem, e o teste de rota que a procurava passa a procurar a `OrderTrackingPage` com "Pedido #3F1C9A52".

### 7. DI, fakes e `CLAUDE.md`
- `registerViewModels()` registra `OrderTrackingViewModel(getIt<OrderRepository>())`.
- `FakeOrderRepository` ganha `enqueueFind`, `holdFind` e `findCalls`. Com a fila vazia, `findMine` devolve `Ok(fakeOrderDetail(id: <id pedido>))`. O pedido de exemplo fica em `test/modules/order/support/order_fixtures.dart`, espelhando o `placedOrderJson`.
- `order_json.dart` ganha o `GET` de exemplo (`orderDetailJson`, o mesmo `placedOrderJson`, mais variações com passos preenchidos, `DELIVERED`, frete zero e instruções) e `orderNotFoundJson` (`404`, `ORDER_NOT_FOUND`).
- `CLAUDE.md`, só acréscimos: "Etapa 13" no estado atual e, em "Regras de domínio", no item **Acompanhamento**: leitura por `GET /me/orders/:id`, `404` = "Pedido não encontrado.", rótulos e passos copiados do web, datas convertidas para o fuso local só na UI e formatadores que recebem a data local.

## Dependências da etapa anterior

Conferidas no código entregue pela change `mobile-app-12-checkout-mobile` (arquivada em 2026-10-15):
- `lib/modules/order/`: `PlacedOrder` (`final class`, `const PlacedOrder(id)`, `number`, igualdade pelo id), `order_rules.dart`, `OrderErrorCode` (sem `ORDER_NOT_FOUND`), `OrderRepository.placeOrder`.
- `lib/infra/api/order_dto.dart` (`encodePlaceOrder`, `parsePlacedOrder`) e `lib/infra/order/api_order_repository.dart` (`ApiOrderRepository(Dio)`, `_path = '/me/orders'`, `mapOrderFailure`).
- `AppRoutes.orders`, `orderSegment = 'orders/:id'`, `orderLocation(id)`; `sessionRequiredPaths = {deliveryDetails, checkout, orders}`.
- `lib/ui/modules/order/pages/order_placed_page.dart` e `test/ui/modules/order/pages/order_placed_page_test.dart`; `test/app/router/app_router_test.dart` usa `OrderPlacedPage.title(fakePlacedOrderId)`.
- Testes: `FakeOrderRepository({placedId})` com `fakePlacedOrderId = '3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f'`; `placedOrderJson` (Banana prata × 2 = 1398, Leite integral 1 L × 1 = 549, subtotal 1947, taxa 799, total 2746, Fortaleza com "Sala 3", "Maria Souza", sem instruções, `placedAt` `2026-10-15T12:00:00.000Z`); `registerFakeDependencies(order:)` em `test/app/support/fake_dependencies.dart`.
- Comuns: `BlockState`, `StateErrorBanner(failure, onRetry, title)`, `EmptyState(title, message, actionLabel, onAction, emoji)`, `SkeletonBox`, `ProductArt`, `categoryArtOf`, `formatMoney`, `AppColors`/`AppRadius`/`AppSpacing`, `RefreshIndicator` da Home como molde.

Se um nome mudar até a aplicação, ela segue o código e registra a diferença abaixo, com o prefixo do lote.

## Decisões tomadas sem consulta

- **Mesma rota da etapa 12** (`/cart/orders/:id`, na pilha da aba Carrinho), em vez de uma rota fora das abas como `/pedidos/:id/acompanhar` do web: o `go` do checkout já tira o checkout da pilha e voltar mostra o carrinho.
- **Sessão pela guarda**, e não pelo aviso "Entre para acompanhar seu pedido." do web: é o padrão de rota protegida do app.
- **Falha que não é `404` mostra o banner com "Tentar de novo"**, e não o aviso com "Voltar para a loja" do web: é a regra de estados de tela remota do `CLAUDE.md`. O `404` é estado vazio, como o produto não encontrado da etapa 7.
- **Mensagem do vazio:** o `EmptyState` exige mensagem e o web só tem o título; entra "Ele não existe ou é de outra conta.".
- **Puxar a tela mostra o skeleton**, como manda o `CLAUDE.md` para toda releitura pedida pelo cliente. A releitura silenciosa, que mantém o pedido na tela, é da etapa 14.
- **Datas:** o modelo guarda UTC, a página converte para o fuso do aparelho, e os formatadores recebem a data local. Sem `intl` de data: os formatos do web são fixos e numéricos.
- **Status desconhecido** no JSON é erro de parsing (falha inesperada, com o banner): a sequência é fechada no backend, e inventar um passo seria pior.
- **Destaque animado** do passo concluído com a tela aberta (`animate-step-done`) não entra: sem SSE, o status só muda ao puxar, e o destaque é do acompanhamento ao vivo (etapa 14).
- **`PlacedOrder` continua** como retorno de `placeOrder`, em vez de passar a `OrderDetail`: o checkout só usa o id, e mudar o contrato não traz nada a esta etapa.
- **`OrderPlacedPage` removida nesta etapa**, e não na varredura da 15: a etapa 12 a declarou provisória até a 13, e ela perde o único consumidor.

## Risks / Trade-offs

- [O backend acrescentar campo ao `OrderDetailDTO`] → o parser ignora campos a mais.
- [O fuso da máquina de teste] → os formatadores recebem `DateTime` local, e os widget tests calculam o esperado com os mesmos formatadores sobre `.toLocal()`.
- [O status muda e a tela não sabe] → o cliente puxa a tela. A etapa 14 liga o SSE.
