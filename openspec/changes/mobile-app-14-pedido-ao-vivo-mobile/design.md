## Context

A etapa 13 (`mobile-app-13-pedido-detalhe-mobile`) entrega a tela de acompanhamento sobre `GET /me/orders/:id`, com o `OrderTrackingViewModel` (leitura por `load()`, um `Future<void>` sem `Command` que passa por `BlockLoading`; `BlockState<OrderDetail>`; contador `_request` que descarta respostas antigas; `refresh()` = `load()`, com skeleton) e deixa para esta etapa o SSE, a releitura silenciosa, o indicador e o destaque do passo.

Contrato (só leitura): `MyOrderController.stream` (`@Sse(':id/stream')`) confere o dono **antes** de abrir o stream, então `401` (guard) e `404` (`ORDER_NOT_FOUND`: inexistente, de outra conta ou id malformado) chegam como respostas JSON comuns. Aberto, ele envia `event: order` com `{ orderId, eventType, messageId, occurredAt }` a cada evento do pedido e `event: ping` a cada 20 s; nunca dados do pedido. Comportamento de referência: `event-stream.util.ts` (`createEventStreamParser`, `openEventStream`, `retryDelayMs`, `FINAL_STATUSES`), `use-my-order.hook.ts`, `coalesced-read.util.ts`, `live-indicator.component.tsx` e o `highlight` de `order-tracking.component.tsx`.

O cliente HTTP (`createApiClient`) tem `receiveTimeout` de 10 s, `ResponseType.json` e `validateStatus` padrão; o `AuthInterceptor` põe o Bearer em toda requisição e encerra a sessão no `401`. O dio é o 5.11.

## Goals / Non-Goals

**Goals:** fonte de avisos SSE pelo dio com o Bearer no cabeçalho; leitor de eventos testado; reconexão com espera crescente, testada com stream fake e relógio controlado; releitura silenciosa e coalescida; indicador ao vivo; parada e retomada por rota, aba e ciclo de vida do app; destaque do passo.

**Non-Goals:**
- Remoção de código morto, testes finais de DI e de rotas, README e `docs/lacunas-da-api.md`: **etapa 15**.
- Em nenhuma etapa (fora do plano): push notifications, modo offline, mapa e entregador, lista "Meus pedidos".

## Decisions

### 1. Domínio (`lib/modules/order/`, Dart puro)
- `model/order_live_status.dart`: `enum OrderLiveStatus { off, connecting, live, reconnecting, closed }`, os estados de `EventStreamStatus` mais o `off` de `MyOrderLiveStatus`.
- `provider/order_live_source.dart`: `abstract interface class OrderLiveSource { Stream<OrderStreamSignal> open(String orderId); }`, uma conexão por chamada. `sealed class OrderStreamSignal` com `OrderStreamOpened` (resposta `200`), `OrderStreamNotice` (um evento `order`) e `OrderStreamRefused(AppFailure failure)` (`401`/`403`/`404`). O stream **nunca emite erro**: termina depois de `Refused` (recusa) ou sem ele (queda). Cancelar a assinatura fecha a conexão.
- `usecase/live_order_feed.dart`: `LiveOrderFeed(OrderLiveSource source, {Future<void> Function(Duration)? wait})`, a cópia de `openEventStream`. `start(orderId, {onStatus, onNotice})` vai a `connecting` e assina `open`; `Opened` → zera a tentativa e `live`; `Notice` → `onNotice`; `Refused` → `closed`, sem nova tentativa; fim sem recusa → `reconnecting`, `await wait(orderStreamRetryDelay(tentativa))`, tentativa + 1 e nova assinatura. `stop()` cancela a assinatura e invalida a espera em curso (um contador de geração, já que um `Future` não se cancela); depois dele nenhum callback é chamado. `start` depois de `stop` recomeça com a tentativa 0. O status não se repete. `wait` padrão: `Future.delayed`.
- `orderStreamRetryDelay(int attempt)`, função pura no mesmo arquivo: `min(1 s × 2^attempt, 10 s)`.
- É caso de uso porque a regra é complexa e testável sem Flutter; fica em `usecase/`, já coberto pela regra A da barreira.

### 2. Infra
- `lib/infra/http/event_stream_parser.dart`: `ServerSentEvent(type, data)` e `EventStreamParser(void Function(ServerSentEvent) onEvent)` com `push(String chunk)`, cópia linha a linha de `createEventStreamParser`: `\n`, `\r\n` e `\r`; `\r` no fim do pedaço espera o próximo; `event:` define o nome (`message` sem ele); várias `data:` juntadas com `\n`; um espaço após `:` removido; linha `:` é comentário; `id:`, `retry:` e campos desconhecidos ignorados; linha em branco despacha; sem `data` nada sai; `data` que não é JSON é descartado (`jsonDecode` em `try`).
- `lib/infra/order/api_order_live_source.dart`: `ApiOrderLiveSource(Dio)`. `open` cria um `StreamController` cujo `onListen` faz `GET /me/orders/<Uri.encodeComponent(id)>/stream` com `Options(responseType: ResponseType.stream, headers: {Accept: text/event-stream}, receiveTimeout: Duration.zero)` e um `CancelToken`. O corpo (`ResponseBody.stream`) passa por `utf8.decoder` (que junta caracteres cortados entre pedaços) e pelo parser: `order` → `Notice`, o resto é ignorado. `DioException` com `401`/`403`/`404` → `Refused(mapHttpFailure(e))` e fecha; qualquer outro erro, inclusive no meio do corpo, ou fim do corpo → fecha. `onCancel` cancela o `CancelToken` e a assinatura do corpo; o `DioException` de cancelamento é engolido.
- Não usa `runRequest`: não há corpo a converter, e a fronteira de exceção é o próprio `StreamController` (nenhuma exceção sai do stream).

### 3. `OrderTrackingViewModel` (estende o da etapa 13)
- Construtor ganha `LiveOrderFeed` como segundo parâmetro posicional obrigatório; a DI e o construtor de teste da etapa 13 são atualizados.
- `live` (`OrderLiveStatus`): `off` sem stream, senão o último status do feed.
- **Quando abre o stream:** depois de qualquer leitura que deixe um pedido não entregue na tela, se o stream está `off`, a tela está ativa e o ViewModel não foi descartado. `closed` não reabre sozinho: só com a próxima ativação (aba ou app).
- **Quando fecha:** pedido `DELIVERED` ou `404` numa releitura, `setActive(false)` e `dispose()`. Ao fechar, `live` volta a `off`.
- **Releitura silenciosa** (`_refetch`), coalescida como `createCoalescedRead`: com uma leitura em andamento, os pedidos seguintes viram **uma** pendente. Chamada por `onNotice` e quando o status passa a `live`. Não chama `load()` nem passa por `BlockLoading`: o `order` continua `BlockLoaded`. Sucesso troca o valor; `404` vira o estado de não encontrado (mesmo `BlockFailed(NotFoundFailure)` da etapa 13) e fecha o stream; outra falha é ignorada. Enquanto `load()` roda (puxar a tela, "Tentar de novo"), a releitura silenciosa é pulada (o ViewModel da etapa 13 não tem `Command` nem sinal de leitura em andamento, então ganha um campo privado para isso); o contador `_request` da etapa 13 passa a valer para as duas leituras, para a resposta de uma leitura antiga nunca sobrescrever a de uma mais nova.
- `setActive(bool active)`: `false` fecha o stream e descarta a pendente; `true` reabre se houver pedido não entregue (a releitura vem com o `live`). Idempotente.
- **Destaque:** `openedStatus` guarda o status da primeira leitura bem-sucedida; `isHighlighted(OrderStatus step)` = passo `done` com índice maior que o de `openedStatus`. Puxar a tela não muda `openedStatus`.

### 4. Tela
- `OrderTrackingPage` (o `State` da etapa 13 que cria e descarta o ViewModel) ganha:
  - `AppLifecycleListener(onHide: …, onShow: …)` criado no `initState` e descartado no `dispose`;
  - o estado de aba visível por `TickerMode` (o `StatefulShellRoute.indexedStack` desliga o `TickerMode` das abas escondidas), lido em `didChangeDependencies` com a API não depreciada do SDK instalado (`TickerMode.of` ou `TickerMode.valuesOf(context).enabled`, o que o `flutter analyze` aceitar);
  - `setActive(abaVisível && appVisível)` a cada mudança.
- `widgets/order_live_indicator.dart`: `OrderLiveIndicator(status)`, ponto de 8 + texto. `live`: ponto e texto `success`, "Ao vivo"; `connecting`/`reconnecting`: ponto `placeholder`, texto `mutedInk`, "Reconectando…"; `off`/`closed`: `SizedBox.shrink()`. Textos como constantes (`liveLabel`, `reconnectingLabel`). Entra no `OrderHeader` ao lado do selo (`Wrap`), recebido como parâmetro. Sem pulso.
- `OrderTimelineStep` ganha `highlight`: `TweenAnimationBuilder` de 1,5 s que leva o fundo de `successSoft` a transparente, rodado uma vez ao montar o passo com `highlight` (a `key` do passo, hoje `ValueKey(step)`, passa a incluir o estado, para remontar quando ele passa a `done`). Com `MediaQuery.disableAnimationsOf(context)`, nada é desenhado. `OrderTimeline` recebe `isHighlighted` do ViewModel. Só tokens do tema (`context.tokens`, `AppRadius`), como o resto de `lib/ui/modules/order/widgets/`.
- `Semantics(liveRegion: true)` no selo do status, como o `aria-live` do web.

### 5. DI, fakes e `CLAUDE.md`
- `configureDependencies`: `OrderLiveSource` → `ApiOrderLiveSource(getIt<Dio>())` (lazy singleton). `registerViewModels()`: `LiveOrderFeed(getIt<OrderLiveSource>())` com `registerFactory` (um por tela), e o `OrderTrackingViewModel` com ele.
- `test/modules/order/support/`: `FakeOrderLiveSource` (cada `open` cria um `StreamController` acessível por `connections`, com `opened()`, `notice()`, `refuse(failure)`, `drop()` e `isCancelled`) e `FakeDelay` (registra as durações pedidas em `requested` e completa sob comando com `elapse()`): é o relógio controlado.
- `FakeHttpClientAdapter` ganha `enqueueStream(Stream<Uint8List> body, {statusCode, headers})` e guarda o `cancelFuture` de cada requisição para o teste ver o cancelamento.
- `registerFakeDependencies` registra um `FakeOrderLiveSource` por padrão (conexões que ficam abertas sem eventos), para os testes de rota.
- `CLAUDE.md`, só acréscimos: "Etapa 14" no estado atual e, no item **Acompanhamento**, o stream por `ApiOrderLiveSource` (`ResponseType.stream`, `receiveTimeout: Duration.zero`, nunca token na URL), o `LiveOrderFeed` e o `setActive` por aba e ciclo de vida.

## Dependências da etapa anterior

Assumidas a partir da change `mobile-app-13-pedido-detalhe-mobile` (em aplicação quando esta foi escrita) e conferidas no código entregue:
- `lib/modules/order/model/`: `OrderStatus` (ordem de `ORDER_STATUSES`, `backendCode`), `OrderDetail` (`freezed`, `status`, `deliveredAt`, `number`, `dateOf`), `order_progress.dart` com `OrderStepState`, `orderStepState(status, step)` e `isOrderFinished(status)`.
- `OrderRepository.findMine(String id)` → `Result<OrderDetail>`, `404` como `NotFoundFailure`; `ApiOrderRepository(Dio)` com `_path = '/me/orders'`.
- `lib/ui/modules/order/view_models/order_tracking_view_model.dart`: `OrderTrackingViewModel(OrderRepository, {DateTime Function()? now})`, `start(orderId)`, `load()` (`Future<void>`, sem `Command`), `order` (`BlockState<OrderDetail>`), `isNotFound`, `refresh()` (= `load()`), `now()`, contador `_request` que descarta leitura antiga, `_disposed`; `registerFactory` em `registerViewModels()`.
- `lib/ui/modules/order/pages/order_tracking_page.dart`: `OrderTrackingPage({orderTrackingViewModelFactory, orderId, onBackToStore})`, `WatchingStatefulWidget` (`watch_it`) cujo `State` cria o ViewModel no `initState` e o descarta no `dispose`; widgets `OrderHeader`, `OrderStatusBadge`, `OrderTimeline`, `OrderTimelineStep`, `OrderItemsCard`, `OrderTrackingSkeleton`; `OrderTimeline.deliveredMessage(time)`; `OrderTimeline` monta cada passo com `key: ValueKey(step)`; o `OrderHeader({order, now})` põe título e `OrderStatusBadge` num `Wrap`; o selo ainda não tem `Semantics(liveRegion: true)`.
- Rota `AppRoutes.orderSegment` (`/cart/orders/:id`, na aba Carrinho do `StatefulShellRoute.indexedStack`) montando a `OrderTrackingPage` com `getIt<OrderTrackingViewModel>()`.
- Testes: `FakeOrderRepository` com `enqueueFind`, `holdFind`, `findCalls`; `fakeOrderDetail(...)` em `test/modules/order/support/order_fixtures.dart`; `orderDetailJson` e variações em `test/infra/api/support/order_json.dart`; `fakePlacedOrderId`; `registerFakeDependencies(order:)`; `FakeHttpClientAdapter` (`enqueueResponse`, `enqueueError`, `requests`).

Se um nome mudar até a aplicação, ela segue o código e registra a diferença abaixo, com o prefixo do lote.

## Decisões tomadas sem consulta

- **Reconexão no domínio** (`LiveOrderFeed`), e não dentro da fonte de infra como no `openEventStream` do web: a regra fica em Dart puro e o teste de tempo não precisa de rede fake.
- **Relógio controlado = `wait` injetado** (`FakeDelay`), e não `fake_async`: o pacote não está entre os permitidos e o `wait` basta para testar as esperas.
- **`receiveTimeout: Duration.zero` no stream** (sem limite no dio 5): os 10 s do cliente derrubariam a conexão entre dois `ping` (20 s).
- **`403` também encerra sem nova tentativa**, como `FINAL_STATUSES` do web, embora o backend hoje só responda `401` e `404` nessa rota.
- **Falha na releitura silenciosa fica em silêncio**, sem o toaster do web: o app não tem toaster nas telas remotas, o pedido continua na tela e o próximo aviso tenta de novo. O `401` encerra a sessão pelo interceptor.
- **Trocar de aba conta como sair da tela**: o `indexedStack` mantém a página montada, e deixar o stream aberto fora da vista gasta bateria e rede.
- **`closed` só reabre na próxima ativação** (aba ou app), e não ao puxar a tela: igual ao web, que não reabre após recusa.
- **Indicador sem pulso**: a animação contínua não acrescenta informação e complicaria os widget tests (`pumpAndSettle`). O destaque do passo usa animação finita.
- **Status ao vivo `off` durante o segundo plano**, e não `reconnecting`: ninguém vê a tela, e ao voltar o feed começa em `connecting`.
- **`LiveOrderFeed` em `registerFactory`**: guarda estado de uma conexão e pertence a uma tela.

## Risks / Trade-offs

- [O dio aplicar `receiveTimeout` diferente ao stream numa versão futura] → o teste da fonte confere o `receiveTimeout` enviado na requisição.
- [Corte de bytes no meio de um caractere UTF-8] → `utf8.decoder` em modo stream; teste com um "ç" partido entre dois pedaços.
- [Leituras demais numa rajada de avisos] → leitura coalescida (no máximo uma em andamento e uma pendente).
- [Resposta antiga sobrescrever a nova] → a mesma geração para a leitura pedida e a silenciosa.
- [Callback depois do `dispose`] → `stop()` invalida a geração do feed e o ViewModel ignora respostas depois de descartado.
