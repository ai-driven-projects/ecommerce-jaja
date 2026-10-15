> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-order-tracking` e `mobile/mobile-checkout` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Conferência e domínio do pedido

- [x] 1.1 Conferir no código os nomes de "Dependências da etapa anterior"; se algo divergir, seguir o código e registrar no `design.md`.
- [x] 1.2 Criar `lib/modules/order/model/order_status.dart` (`OrderStatus` com `backendCode` e `fromBackendCode`) e `order_number.dart` (`orderNumberOf`); `PlacedOrder.number` passa a usá-lo (Decisão 1).
- [x] 1.3 Criar `lib/modules/order/model/order_entity.dart` em `freezed` (`OrderDetail` com `number` e `dateOf`, `OrderItem`, `OrderDeliveryAddress`) e rodar o `build_runner` (Decisão 1).
- [x] 1.4 Criar `lib/modules/order/model/order_progress.dart` com `OrderStepState`, `orderStepState` e `isOrderFinished` (Decisão 1).
- [x] 1.5 Acrescentar `findMine(String id)` a `OrderRepository`, e ao `FakeOrderRepository` `enqueueFind`, `holdFind` e `findCalls`, com o pedido de `test/modules/order/support/order_fixtures.dart` (Decisão 7).
- [x] 1.6 Testes em `test/modules/order/model/`: `fromBackendCode` dos cinco códigos e de um desconhecido; `orderNumberOf`; `dateOf` de cada passo.
- [x] 1.7 Testes de `orderStepState` em `test/modules/order/model/order_progress_test.dart`: `PLACED` (1 `done`, 1 `current`, 3 `pending`), `PAYMENT_APPROVED` e `DELIVERED` (5 `done`, nenhum `current`); `isOrderFinished`.

## 2. Leitura de `GET /me/orders/:id`

- [x] 2.1 Em `test/infra/api/support/order_json.dart`, acrescentar `orderDetailJson` e as variações (passos preenchidos, `DELIVERED`, frete 0, instruções) e `orderNotFoundJson` (`404`, `ORDER_NOT_FOUND`) (Decisão 7).
- [x] 2.2 Criar `parseOrderDetail` em `lib/infra/api/order_dto.dart` (Decisão 2).
- [x] 2.3 Testes em `test/infra/api/order_dto_test.dart`: o exemplo vira `OrderDetail` com itens, endereço, `Money` e datas UTC; complemento, foto e instruções `null`; status desconhecido, campo obrigatório ausente, centavos negativos e data inválida → erro de parsing.
- [x] 2.4 Implementar `ApiOrderRepository.findMine` (`GET /me/orders/<id codificado>`) (Decisão 2).
- [x] 2.5 Testes em `test/infra/order/api_order_repository_test.dart` (`FakeHttpClientAdapter`): método e caminho (id com caractere especial codificado); `200` → `Ok(OrderDetail)`; `404` → `NotFoundFailure`; `401`, `500`, rede e corpo fora do formato passam como falha.

## 3. Formatadores e ViewModel

- [x] 3.1 Criar `lib/ui/modules/order/view_models/order_formatters.dart` (Decisão 3).
- [x] 3.2 Testes em `test/ui/modules/order/view_models/order_formatters_test.dart`: `09:03`/`09:03:07` com zeros à esquerda; "Feito hoje às 09:03" e "Feito em 14/10/2026 às 18:30"; endereço com e sem complemento (e complemento em branco); os cinco rótulos.
- [x] 3.3 Criar `lib/ui/modules/order/view_models/order_tracking_view_model.dart` (Decisão 4) e registrá-lo com `registerFactory` em `registerViewModels()`; conferir em `service_locator_test.dart`.
- [x] 3.4 Testes em `test/ui/modules/order/view_models/order_tracking_view_model_test.dart`: `start` pede o id (`findCalls`) e passa por `BlockLoading` até `BlockLoaded`; `404` → `isNotFound`; `500` → `BlockFailed` sem `isNotFound`.
- [x] 3.5 Testes no mesmo arquivo: `refresh()` pede de novo e mostra o status novo; resposta de uma leitura anterior que chega depois é descartada (`holdFind`); `now()` usa o relógio injetado.

## 4. Tela de acompanhamento

- [x] 4.1 Criar em `lib/ui/modules/order/widgets/` `OrderStatusBadge`, `OrderHeader`, `OrderTimelineStep` e `OrderTimeline`, só com tokens do tema (Decisão 5).
- [x] 4.2 Criar `OrderItemsCard`, `OrderInstructionsCard` e `OrderTrackingSkeleton` no mesmo diretório (Decisão 5).
- [x] 4.3 Criar `lib/ui/modules/order/pages/order_tracking_page.dart` com `RefreshIndicator` e os quatro estados, textos como constantes públicas (Decisão 5).
- [x] 4.4 Widget tests em `test/ui/modules/order/pages/order_tracking_page_test.dart`, cabeçalho: "Pedido #3F1C9A52", selo "Pedido recebido", "Feito hoje às …" (esperado calculado com o formatador sobre `.toLocal()`), endereço e "Quem recebe: Maria Souza".
- [x] 4.5 Widget tests da linha do tempo: `PAYMENT_APPROVED` mostra as duas horas, "Em andamento…" e dois "Aguardando"; `DELIVERED` mostra o aviso de entregue e nenhum "Em andamento…".
- [x] 4.6 Widget tests de itens e totais: as duas linhas com "× n" e totais; R$ 19,47, R$ 7,99, R$ 27,46 e "Pagamento simulado"; frete 0 → "Grátis"; instruções só quando existem.
- [x] 4.7 Widget tests dos estados: skeleton (`holdFind`); `404` → "Pedido não encontrado." e "Voltar para a loja" chama `onBackToStore`; `500` → banner e "Tentar de novo" mostra o pedido; puxar a tela (`fling`) pede de novo e mostra o status novo.
- [x] 4.8 Widget test do `OrderStatusBadge` em `test/ui/modules/order/widgets/`: rótulo de cada status e as cores de fundo `successSoft`, `warningSoft` e `surface`.

## 5. Rota, remoção da página provisória e CLAUDE.md

- [x] 5.1 Em `app_router.dart`, a rota `AppRoutes.orderSegment` passa a montar a `OrderTrackingPage` (Decisão 6); remover `order_placed_page.dart` e `order_placed_page_test.dart`.
- [x] 5.2 Em `app_router_test.dart`, trocar `OrderPlacedPage` pela `OrderTrackingPage`: confirmar leva a `/cart/orders/<id>` com "Pedido #3F1C9A52" e voltar mostra a aba Carrinho.
- [x] 5.3 Teste em `app_router_test.dart`: sem sessão, `/cart/orders/<id>` leva a `/login?from=/cart/orders/<id>`; com sessão, abre o acompanhamento com a aba Carrinho selecionada.
- [x] 5.4 Conferir que `test/core/architecture_test.dart` cobre os arquivos novos sem regra nova (modelo sem Flutter, widgets sem cor literal).
- [x] 5.5 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 7 pede, sem afrouxar regra existente.

## 6. Verificação final

- [x] 6.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart`/`.g.dart` estão em dia.
- [x] 6.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 6.3 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [x] 6.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
