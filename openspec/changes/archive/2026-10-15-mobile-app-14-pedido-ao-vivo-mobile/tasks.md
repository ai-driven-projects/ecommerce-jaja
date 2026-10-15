> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e a spec `mobile/mobile-order-tracking` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Conferência e domínio do acompanhamento ao vivo

- [x] 1.1 Conferir no código os nomes de "Dependências da etapa anterior" (etapa 13 entregue); se algo divergir, seguir o código e registrar no `design.md`.
- [x] 1.2 Criar `lib/modules/order/model/order_live_status.dart` e `lib/modules/order/provider/order_live_source.dart` (`OrderLiveSource`, `OrderStreamSignal` e subclasses) (Decisão 1).
- [x] 1.3 Criar `lib/modules/order/usecase/live_order_feed.dart` com `orderStreamRetryDelay` e `LiveOrderFeed` (Decisão 1).
- [x] 1.4 Criar em `test/modules/order/support/` o `FakeOrderLiveSource` e o `FakeDelay` (Decisão 5).
- [x] 1.5 Testes em `test/modules/order/usecase/live_order_feed_test.dart`: `orderStreamRetryDelay` de 0 a 6 (1, 2, 4, 8, 10, 10, 10 s); `start` → `connecting`; `Opened` → `live`; `Notice` → `onNotice`, sem repetir status.
- [x] 1.6 Testes no mesmo arquivo: cinco quedas seguidas pedem 1, 2, 4, 8 e 10 s ao `FakeDelay` e abrem nova conexão após cada `elapse()`; depois de `Opened`, a queda seguinte volta a 1 s.
- [x] 1.7 Testes no mesmo arquivo: `Refused` → `closed` e nenhuma espera; `stop()` cancela a conexão (`isCancelled`), e uma espera completada depois do `stop` não abre conexão nem chama callback; `start` depois de `stop` começa em 1 s.

## 2. Leitor de eventos e fonte de avisos pelo dio

- [x] 2.1 Criar `lib/infra/http/event_stream_parser.dart` (`ServerSentEvent`, `EventStreamParser`) (Decisão 2).
- [x] 2.2 Testes em `test/infra/http/event_stream_parser_test.dart`: evento com `event:` e `data:` JSON; sem `event:` → `message`; várias `data:` juntadas; comentário, `id:`, `retry:` e linha sem `data` ignorados; `data` que não é JSON descartado.
- [x] 2.3 Testes no mesmo arquivo: `\r\n` e `\r` como fim de linha; evento cortado em qualquer ponto entre dois `push`; `\r` no fim de um pedaço seguido de `\n` no próximo despacha uma vez só.
- [x] 2.4 Acrescentar `enqueueStream` e o registro do `cancelFuture` ao `FakeHttpClientAdapter` em `test/infra/http/support/` (Decisão 5), sem mudar o comportamento atual.
- [x] 2.5 Criar `lib/infra/order/api_order_live_source.dart` (`ApiOrderLiveSource`) (Decisão 2).
- [x] 2.6 Testes em `test/infra/order/api_order_live_source_test.dart`: `GET /me/orders/<id codificado>/stream` com `Accept: text/event-stream`, `ResponseType.stream`, `receiveTimeout` zero e sem token na URL; `200` → `Opened`; `order` → `Notice`; `ping` e outro nome ignorados.
- [x] 2.7 Testes no mesmo arquivo: "ç" partido entre dois pedaços chega inteiro; `401`, `403` e `404` → `Refused` com a falha mapeada e fim; `500`, erro de rede e fim do corpo → fim sem `Refused` e sem erro no stream; cancelar a assinatura completa o `cancelFuture`.

## 3. ViewModel ao vivo

- [x] 3.1 Estender `OrderTrackingViewModel` com o `LiveOrderFeed`, `live`, a releitura silenciosa coalescida, `setActive`, `openedStatus` e `isHighlighted` (Decisão 3); atualizar o construtor nos testes da etapa 13.
- [x] 3.2 Registrar `OrderLiveSource` e `LiveOrderFeed` na DI e passar o feed ao `OrderTrackingViewModel` (Decisão 5); conferir em `service_locator_test.dart`.
- [x] 3.3 Testes em `test/ui/modules/order/view_models/order_tracking_view_model_live_test.dart` (`FakeOrderLiveSource`, `FakeDelay`): pedido não entregue abre o stream; `DELIVERED` não abre e `live` fica `off`; falha na primeira leitura não abre.
- [x] 3.4 Testes no mesmo arquivo: `Opened` → `live` e uma releitura sem `BlockLoading`; `Notice` com o pedido em `PICKING` atualiza o `order`; três `Notice` com uma leitura presa (`holdFind`) geram só mais uma leitura.
- [x] 3.5 Testes no mesmo arquivo: releitura com `DELIVERED` fecha o stream (`isCancelled`, `live` `off`); releitura com `404` → `isNotFound` e stream fechado; releitura com `500` mantém o pedido.
- [x] 3.6 Testes no mesmo arquivo: `setActive(false)` fecha e `live` `off`; `setActive(true)` reabre com a espera em 1 s; `Refused` → `closed` sem reabrir até a próxima ativação; `dispose` fecha e ignora respostas pendentes.
- [x] 3.7 Testes no mesmo arquivo: `isHighlighted` falso para os passos concluídos ao abrir e verdadeiro para o passo concluído depois; puxar a tela não muda `openedStatus`.

## 4. Tela: indicador, destaque e ciclo de vida

- [x] 4.1 Criar `lib/ui/modules/order/widgets/order_live_indicator.dart` e colocá-lo no `OrderHeader` ao lado do selo; `Semantics(liveRegion: true)` no selo (Decisão 4).
- [x] 4.2 Acrescentar o `highlight` ao `OrderTimelineStep` e o `isHighlighted` ao `OrderTimeline`, só com tokens do tema (Decisão 4).
- [x] 4.3 Ligar na `OrderTrackingPage` o `AppLifecycleListener` e o `TickerMode` ao `setActive` (Decisão 4).
- [x] 4.4 Widget test do `OrderLiveIndicator` em `test/ui/modules/order/widgets/`: "Ao vivo" em `live`, "Reconectando…" em `connecting` e `reconnecting`, nada em `off` e `closed`.
- [x] 4.5 Widget tests em `test/ui/modules/order/pages/order_tracking_page_live_test.dart`: "Ao vivo" depois de `Opened`; `Notice` com o pedido em `PICKING` mostra "Separando na loja" sem skeleton; queda mostra "Reconectando…".
- [x] 4.6 Widget tests no mesmo arquivo: `Notice` que leva a `DELIVERED` mostra o aviso de entregue, esconde o indicador e cancela a conexão; o passo concluído com a tela aberta tem o destaque e, com `disableAnimations`, não tem.
- [x] 4.7 Widget tests no mesmo arquivo: `handleAppLifecycleStateChanged` para `paused` cancela a conexão e esconde o indicador; de volta a `resumed`, abre nova conexão e relê o pedido; desmontar a página cancela a conexão.

## 5. Rota, aba e CLAUDE.md

- [x] 5.1 Registrar por padrão um `FakeOrderLiveSource` em `registerFakeDependencies` (Decisão 5) e conferir que os testes de rota da etapa 13 seguem passando.
- [x] 5.2 Teste em `app_router_test.dart`: com o acompanhamento aberto, ir para a aba Início cancela a conexão; voltar à aba Carrinho abre uma nova.
- [x] 5.3 Teste em `app_router_test.dart`: voltar do acompanhamento para a aba Carrinho cancela a conexão e nenhuma nova é aberta.
- [x] 5.4 Conferir que `test/core/architecture_test.dart` cobre os arquivos novos sem regra nova (`lib/modules/order/usecase/` puro, dio só em `lib/infra/`, widgets sem cor literal).
- [x] 5.5 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 5 pede, sem afrouxar regra existente.

## 6. Verificação final

- [x] 6.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart`/`.g.dart` estão em dia.
- [x] 6.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 6.3 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [x] 6.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
