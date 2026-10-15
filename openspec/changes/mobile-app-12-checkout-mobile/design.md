## Context

Com sessão, o carrinho do app é o `SessionCartRepository` (etapa 10). Ele lê `/me/cart`, faz `refresh()` (remescla se houver itens locais, senão `GET /me/cart` na fila), `remove` com `Result` e `CartState` (`isRestoring`, `isSyncing`, `previewFailure`, `detail.hasUnavailableItems`). A aba Carrinho tem "Finalizar pedido · <total>" fixo e **desabilitado** (`_CheckoutBar` com `onPressed: null`). A etapa 11 entrega o domínio `customer` (`CustomerRepository.fetchMine` → `Customer?`, `404` = sem cadastro), a tela "Dados de entrega" em `/account/delivery` (em `sessionRequiredPaths`) e o `BlockState` em `ui/shared/`.

Contrato (só leitura): `MyOrderController` e `order-http.ts` em `apps/backend/src/modules/orders/`. O pedido é **`POST /me/orders`** (`201` com `OrderDetailDTO`). Do corpo, o servidor só lê `recipientName` e `deliveryInstructions` quando são texto. `ORDER_NOT_FOUND` → `404`, `ORDER_ALREADY_EXISTS` → `409`, o resto → `400`, com os códigos sem repetição, parando na primeira regra. Limites: `ORDER_RECIPIENT_NAME_MAX_LENGTH = 100` (mínimo 2 no `order.entity.ts`) e `ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200` (`modules/orders/src/order/errors.ts`). Comportamento e textos: `checkout.page.tsx`, `order.api.ts`, `order.util.ts` (`formatOrderNumber`), `customer-delivery-summary.component.tsx` e `formatCustomerAddress` (`customer.util.ts`), `cart-drawer.component.tsx` (botão indisponível com `busy` ou indisponíveis) e as mensagens `ORDER_*` de `apps/frontend/src/shared/i18n/messages.pt.ts`.

## Goals / Non-Goals

**Goals:** checkout com sessão na pilha da aba Carrinho; dados de entrega exigidos, reusando a tela da etapa 11; confirmação por `POST /me/orders` com as recusas traduzidas; ida ao pedido criado.

**Non-Goals (ficam para outras etapas):**
- `GET /me/orders/:id`, o `OrderDetail` completo com DTO e teste de parsing, a linha do tempo, os itens, os totais e o endereço do pedido: etapa 13. Ela troca a página provisória desta etapa (Decisão 6) e estende o domínio `order` daqui.
- SSE e acompanhamento ao vivo: etapa 14.
- Varredura de textos e de código sem uso (o `clear()` do carrinho continua sem consumidor), testes finais de DI e rotas e `docs/lacunas-da-api.md`: etapa 15.
- Em nenhuma etapa (fora do plano): pagamento real, seletor de forma de pagamento, aviso de cobertura, mapa, "Meus pedidos".

## Decisions

### 1. Domínio `order` (`lib/modules/order/`), só o fechamento
- `model/placed_order.dart`: `PlacedOrder(id)`, classe imutável à mão (sem `freezed`: a entidade completa nasce na etapa 13). O getter `number` dá os 8 primeiros caracteres do id em maiúsculas (`formatOrderNumber`).
- `model/order_rules.dart`: `orderRecipientNameMaxLength = 100` e `orderDeliveryInstructionsMaxLength = 200`, com a origem num comentário.
- `errors/order_errors.dart`: `enum OrderErrorCode` com `backendCode` e `message`, um valor por código com texto no web (`ORDER_ALREADY_EXISTS`, `ORDER_CART_EMPTY`, `ORDER_CART_HAS_UNAVAILABLE_ITEMS`, `ORDER_CUSTOMER_INACTIVE`, `ORDER_CUSTOMER_NOT_FOUND`, `ORDER_CUSTOMER_REQUIRED`, `ORDER_DELIVERY_ADDRESS_INVALID`, `ORDER_ITEMS_LIMIT_EXCEEDED`, `ORDER_ITEMS_REQUIRED`, `ORDER_ITEM_DUPLICATED`, `ORDER_ITEM_PRICE_INVALID`, `ORDER_ITEM_QUANTITY_INVALID`, `ORDER_PRODUCT_NOT_FOUND`, `TEXT_TOO_SHORT`, `TEXT_TOO_LONG`), com os textos copiados de `messages.pt.ts`. Entram também `orderErrorFromCodes(List<String>)` (primeiro conhecido, na ordem recebida, no molde do `cartErrorFromCodes`) e `isCustomerRejection(List<String>)` (algum código começa com `ORDER_CUSTOMER_`, como o `isCustomerFailure` do web).
- `provider/order_repository.dart`: `Future<Result<PlacedOrder>> placeOrder({required String recipientName, required String deliveryInstructions})`. A etapa 13 acrescenta a leitura.

### 2. Infra
- `lib/infra/api/order_dto.dart`: `encodePlaceOrder(recipientName, deliveryInstructions)` → `{"recipientName", "deliveryInstructions"}`, com os textos **como digitados**. Quem apara e troca vazio por padrão é o servidor. `parsePlacedOrder(Object?)` lê só `id` (texto não vazio; senão erro de parsing) e ignora o resto do `OrderDetailDTO`.
- `lib/infra/order/api_order_repository.dart`: `ApiOrderRepository(Dio)`, com `placeOrder` = `POST /me/orders` por `runRequest`. `mapOrderFailure` traduz como o `mapCartFailure`: um `BackendRejectionFailure` com código conhecido vira o mesmo tipo, com `message`/`code` do `OrderErrorCode` e o mesmo `statusCode`/`codes`. As outras falhas passam como vieram, inclusive a recusa sem código conhecido ("Não foi possível concluir. Tente novamente."), `401`, `5xx` e rede.

### 3. Rotas (`AppRoutes`, `app_router.dart`)
- `checkout = '/cart/checkout'` (filha de `/cart`), `checkoutDelivery = '/cart/checkout/delivery'` (filha do checkout) e `orderLocation(id) = '/cart/orders/<id codificado>'` (filha de `/cart`, segmento `orders/:id`). `sessionRequiredPaths` ganha `checkout` e `'/cart/orders'`. O prefixo já cobre a rota dos dados de entrega abaixo do checkout.
- A `CartPage` ganha `onOpenCheckout` (`context.go(AppRoutes.checkout)`). A guarda da etapa 8 leva a `/login?from=/cart/checkout` sem sessão e devolve ao checkout depois de entrar. Nenhuma tela checa a sessão.
- No checkout, `onOpenDeliveryDetails` é `() => context.push(AppRoutes.checkoutDelivery)`, devolvendo o `Future` do `push`. A página espera o retorno e manda o ViewModel consultar o cadastro de novo. O `builder` dessa rota monta a mesma `DeliveryDetailsPage` da etapa 11, com `onSaved: () => context.pop()`.
- Sucesso: `context.go(AppRoutes.orderLocation(id))`. O `go` remonta a pilha da aba como `/cart` → `/cart/orders/<id>`, então o checkout sai da pilha, voltar mostra o carrinho vazio e a aba não "lembra" do checkout.

### 4. `CheckoutViewModel` (`lib/ui/modules/order/view_models/`)
- Recebe `CartRepository`, `CustomerRepository`, `AuthRepository` e `OrderRepository`. É registrado com `registerFactory`. Sem caso de uso: só o ViewModel junta os quatro, e nada é reusado (regra 4).
- `cart`: `CartState`, começa com `cartRepository.state` e é atualizado pela assinatura de `changes` (cancelada no `dispose`). `customer`: `BlockState<Customer?>`, com `loadCustomer()`. `open()` (no `initState`) chama `cartRepository.refresh()` e `loadCustomer()`, como o `useEffect` do web.
- `recipientName` começa com `currentUser?.name ?? ''`, e `instructions` começa vazio. Os dois são alterados por `updateRecipientName`/`updateInstructions`, sem validação local.
- Derivados: `cartReady` = não `isRestoring`, não `awaitsFirstPreview`, sem `previewFailure`, não vazio, não `isSyncing` e sem indisponíveis. `deliveryReady` = `BlockLoaded` com cadastro. `canConfirm` = os dois e `!confirm.running`. `showsUnavailableHint` = carrinho exibido com indisponíveis. `showsDeliveryHint` = `BlockLoaded(null)`.
- `confirm`: `Command0<PlacedOrder>`. Se `!canConfirm`, nada é enviado. No `Ok`, `cartRepository.refresh()`. Na `Failure`, `cartRepository.refresh()` e, se for `BackendRejectionFailure` com `isCustomerRejection(codes)`, `loadCustomer()`. `failureMessage` lê o `failure.message`.
- `removeLine`: `Command1<void, String>` sobre `cartRepository.remove`. A falha vai para `failureMessage`, como na `CartViewModel`.

### 5. Tela (`lib/ui/modules/order/`)
- `CheckoutPage` (composição): `AppBar` "Finalizar pedido" com voltar, e um `ListView` com três cartões. "1 Endereço de entrega": `DeliveryStep` (skeleton, `StateErrorBanner` "Não foi possível carregar seus dados.", convite com `AppButton` "Preencher dados de entrega", ou resumo com "Alterar") e depois `OrderNoteFields` ("Quem recebe" e "Instruções para o entregador" em `AppTextField` com `maxLength` das constantes). "2 Pagamento": o selo "Simulado" (`ProductBadge` com a variante `brand`) e o texto. "Resumo do pedido": `CheckoutSummary`. No rodapé fixo, no molde do `_CheckoutBar`: "Confirmar pedido · <total>"/"Confirmando…", os avisos e "Ao confirmar, você concorda com os termos do já já.". Os textos ficam como constantes públicas da página.
- Os controllers dos dois campos são criados no `initState` com os valores do ViewModel.
- O sucesso mostra o `SnackBar` "Pedido #<número> recebido" com a linha "Pagamento simulado em andamento.", pelo `ScaffoldMessenger` capturado **antes** de navegar (ele é do app e sobrevive à troca de rota), e chama `onOrderPlaced(id)`. A falha mostra o `SnackBar` com `failureMessage`.
- Widgets: `CheckoutStepCard` (número em círculo da marca, título e selo opcional), `DeliveryStep`, `OrderNoteFields`, `PaymentStep`, `CheckoutSummary` e `CheckoutLineTile`. Esta mostra `ProductArt` 44, nome, "× n" e total, ou "Indisponível" e "Remover". O selo "Indisponível" segue o da `CartLineTile`.
- Totais: a `CartSummary` ganha o construtor `CartSummary.checkout(detail:, isSyncing:)`, com "Entrega de bike", sem "Faltam…" e sem o aviso de indisponíveis (o checkout tem o seu abaixo do botão). A aba Carrinho não muda.
- Endereço em uma linha: `formatDeliveryAddress(CustomerAddress)` em `lib/ui/modules/customer/view_models/delivery_address_line.dart`, cópia de `formatCustomerAddress`. O CEP sai pelo `formatZipCodeInput` e o telefone pelo `formatPhoneInput` da etapa 11.

### 6. Página provisória do pedido
`OrderPlacedPage(orderId, onBackToStore)` em `lib/ui/modules/order/pages/`: `AppBar` com voltar e `EmptyState` (🚲, "Pedido #<número> recebido", "Pagamento simulado em andamento.", "Voltar para a loja" → `context.go(AppRoutes.home)`). O número sai de `PlacedOrder(id).number`. A etapa 13 troca a página na mesma rota.

### 7. Ajustes nas telas entregues
- `CartPage`: o `_CheckoutBar` recebe `onPressed`. Ele é `null` com `state.isSyncing` ou `detail.hasUnavailableItems`; senão, chama `onOpenCheckout`. A classe da página passa a dizer que o botão abre o checkout.
- `DeliveryDetailsPage`: ganha `VoidCallback? onSaved`, chamado depois do `SnackBar` "Dados salvos". Na rota da aba Conta, ele não é passado.

### 8. DI, fakes e `CLAUDE.md`
- `OrderRepository` → `ApiOrderRepository` (lazy singleton) e `CheckoutViewModel` (factory). `registerFakeDependencies` aceita `order:`.
- `test/modules/order/support/fake_order_repository.dart`: `enqueuePlace`, `holdPlace` (com `Completer`) e `placeCalls`. `test/infra/api/support/order_json.dart`: o `OrderDetailDTO` de exemplo do `201` e as recusas.
- `CLAUDE.md`, só acréscimos: "Etapa 12" no estado atual. Em "Regras de domínio", o item **Pedido** traz `POST /me/orders` (não `/me/cart/orders`), o corpo só com quem recebe e instruções, sem validação local, `mapOrderFailure`, o carrinho relido e nunca esvaziado pelo app, e as rotas da Decisão 3. Sai a frase "Finalizar pedido aparece desabilitado até a etapa 12": é descrição de estado, não regra.

## Dependências da etapa anterior

Assumidas da change `mobile-app-11-dados-entrega-mobile` (não conferidas no código, que estava em obras):
- `lib/modules/customer/model/customer_entity.dart`: `Customer(id, cpf, phone, address)` e `CustomerAddress(zipCode, street, number, complement?, neighborhood, city, state, location?)`, com textos crus da API (CEP e telefone só com dígitos).
- `lib/modules/customer/provider/customer_repository.dart`: `Future<Result<Customer?>> fetchMine()` (`null` = sem cadastro) e `saveMine(CustomerDraft)`, registrado na DI como `CustomerRepository` lazy singleton.
- `lib/ui/shared/view_models/block_state.dart`: `BlockLoading`, `BlockFailed(failure)` e `BlockLoaded(value)`.
- `lib/ui/modules/customer/view_models/customer_masks.dart`: `formatPhoneInput` e `formatZipCodeInput`.
- `lib/ui/modules/customer/pages/delivery_details_page.dart`: `DeliveryDetailsPage` com a fábrica `DeliveryDetailsViewModel` (`registerFactory`), o `SnackBar` "Dados salvos" no sucesso do `save`, e o `AppTextField` com `inputFormatters`.
- `AppRoutes.deliveryDetails = '/account/delivery'` em `sessionRequiredPaths`. `session_redirect_test.dart` exige só essa rota.
- `test/modules/customer/support/{customer_fixtures,fake_customer_repository}.dart` (`enqueueFetch`, `enqueueSave`) e `registerFakeDependencies(..., customer:)`.
- Das etapas 8 a 10 (conferidas no código): `CartRepository` (`state`, `changes`, `remove` → `Result`, `refresh()`), `CartState` (`isRestoring`, `awaitsFirstPreview`, `isSyncing`, `previewFailure`, `lines`, `isEmpty`, `detail`), `CartPage` com `_CheckoutBar`, `checkoutLabel` e `cartViewModelFactory`/`onOpenProduct`/`onOpenSearch`, `CartSummary(detail, isSyncing)`, `AuthRepository.currentUser` (`AuthUser.name`), `BackendRejectionFailure(statusCode, codes)`, `runRequest`, `StateErrorBanner`, `EmptyState`, `AppButton`, `AppTextField`, `ProductArt`, `FakeCartRepository` e `FakeAuthRepository`.

Se um nome diferir, a aplicação segue o nome entregue e registra a diferença abaixo, com o prefixo do lote.

## Decisões tomadas sem consulta

- **Endpoint:** o plano diz `POST /me/cart/orders`, mas o backend expõe `POST /me/orders` (`MyOrderController`), que é o que o web usa. Vale o controller. Não é uma lacuna de API, então nada vai para `docs/lacunas-da-api.md`.
- **Sessão obrigatória pela guarda**, e não pelo formulário de entrar dentro do checkout como no web. É o padrão de rota protegida do app (etapa 8) e mantém uma ação principal por tela.
- **Dados de entrega numa tela empilhada** (a mesma da etapa 11), e não um formulário dentro do checkout. O checkout só mostra o resumo, o convite ou "Alterar". "Cancelar" é o voltar da tela empilhada.
- **Rotas na pilha da aba Carrinho** (`/cart/checkout`, `/cart/orders/:id`), para o `go` do sucesso tirar o checkout da pilha e a aba voltar ao carrinho. A etapa 13 pode mover a rota do pedido se precisar, registrando a mudança.
- **Página do pedido provisória** com o número e "Voltar para a loja", porque o plano manda navegar ao acompanhamento, que só existe na etapa 13.
- **"Pedido #… recebido" num `SnackBar`** com as duas linhas, no lugar do toaster do web. Recusas também vão para `SnackBar`, como as do carrinho.
- **"Quem recebe" e instruções sem validação local**, como no web. O mínimo de 2 caracteres vem da API como `TEXT_TOO_SHORT`.
- **Carrinho vazio no checkout** mostra o vazio padrão com "Voltar para a loja" (aba Início), como o link do web.
- **"Finalizar pedido" da aba** fica desabilitado com mudança pendente ou indisponíveis, como o `cart-drawer` do web. A spec da aba dizia "desabilitada até o checkout existir".
- **A spec `mobile-navigation` "Guarda de sessão"** perde a frase de que nenhuma rota exige sessão (a etapa 11 já tinha acrescentado uma).
- A carga do carrinho feita pelo `refresh()` com o carrinho já exibido **não** mostra skeleton: o `SessionCartRepository` só sinaliza `isRestoring` antes da primeira resposta. O servidor confere tudo de novo na confirmação.

## Risks / Trade-offs

- [Confirmar com o resumo ainda sendo relido] → o servidor lê o carrinho na hora e recusa com `ORDER_CART_*`, o app relê e mostra a mensagem.
- [Toque duplo em "Confirmar"] → o `Command` em execução desabilita o botão, e um segundo `POST` receberia `ORDER_CART_EMPTY`.
- [Nome assumido da etapa 11 diferente do entregue] → a tarefa 1.1 confere tudo antes de começar.
