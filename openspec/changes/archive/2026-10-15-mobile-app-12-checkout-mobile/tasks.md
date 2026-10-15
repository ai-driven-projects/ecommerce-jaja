> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-checkout`, `mobile/mobile-cart`, `mobile/mobile-customer` e `mobile/mobile-navigation` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Conferência e domínio `order`

- [x] 1.1 Conferir no código os nomes de "Dependências da etapa anterior" (já revisados contra a etapa 11 entregue); se algo divergir, seguir o código e registrar no `design.md`.
- [x] 1.2 Criar `lib/modules/order/model/{placed_order,order_rules}.dart` (`PlacedOrder` com `number`, limites 100/200 com a origem) (Decisão 1).
- [x] 1.3 Criar `lib/modules/order/errors/order_errors.dart` com `OrderErrorCode`, `orderErrorFromCodes` e `isCustomerRejection` (Decisão 1).
- [x] 1.4 Criar `lib/modules/order/provider/order_repository.dart` com `placeOrder` (Decisão 1).
- [x] 1.5 Testes em `test/modules/order/model/placed_order_test.dart`: id `3f1c9a52-7b1e-…` → `number` `3F1C9A52`; id curto (`ab`) → `AB`.
- [x] 1.6 Testes em `test/modules/order/errors/order_errors_test.dart`: cada código vira o seu texto; `['ALGO_NOVO', 'ORDER_CART_EMPTY']` → `cartEmpty`; sem código conhecido → `null`; `isCustomerRejection` com `ORDER_CUSTOMER_INACTIVE` e sem ele.
- [x] 1.7 Conferir que `test/core/architecture_test.dart` já cobre `lib/modules/order/` (Dart puro) sem regra nova; `flutter analyze` sem problemas.

## 2. Cliente de `POST /me/orders`

- [x] 2.1 Criar `test/infra/api/support/order_json.dart` com o `OrderDetailDTO` do `201` e as recusas `400` (`ORDER_CUSTOMER_REQUIRED`, `ORDER_CUSTOMER_INACTIVE`, `ORDER_CART_HAS_UNAVAILABLE_ITEMS`, `TEXT_TOO_SHORT`, `ALGO_NOVO`).
- [x] 2.2 Criar `lib/infra/api/order_dto.dart` com `encodePlaceOrder` e `parsePlacedOrder` (Decisão 2).
- [x] 2.3 Testes em `test/infra/api/order_dto_test.dart`: o `201` de exemplo → `PlacedOrder` com o id; sem `id` ou vazio → erro de parsing; corpo com os dois campos como digitados (inclusive vazios).
- [x] 2.4 Criar `lib/infra/order/api_order_repository.dart` com `ApiOrderRepository` e `mapOrderFailure` (Decisão 2).
- [x] 2.5 Testes em `test/infra/order/api_order_repository_test.dart` (`Dio` + `FakeHttpClientAdapter`): método `POST`, caminho `/me/orders` e corpo; `201` → `Ok(PlacedOrder)`; `ORDER_CUSTOMER_INACTIVE` → texto do web com `statusCode`/`codes` mantidos; `ALGO_NOVO`, `401`, `500` e rede passam como vieram.
- [x] 2.6 Em `service_locator.dart`, `OrderRepository` → `ApiOrderRepository` (lazy singleton); conferir em `service_locator_test.dart`, inclusive a remoção no `resetDependencies`.
- [x] 2.7 Criar `test/modules/order/support/fake_order_repository.dart` (`enqueuePlace`, `holdPlace`, `placeCalls`) e aceitar `order:` em `registerFakeDependencies`.

## 3. `CheckoutViewModel`

- [x] 3.1 Criar `lib/ui/modules/customer/view_models/delivery_address_line.dart` com `formatDeliveryAddress` e testes (com e sem complemento, CEP mascarado) em `test/ui/modules/customer/view_models/`.
- [x] 3.2 Criar `lib/ui/modules/order/view_models/checkout_view_model.dart` (Decisão 4) e registrá-lo com `registerFactory` em `registerViewModels()`.
- [x] 3.3 Testes de abertura em `test/ui/modules/order/view_models/checkout_view_model_test.dart` (`FakeCartRepository`, `FakeCustomerRepository`, `FakeAuthRepository`, `FakeOrderRepository`): `open()` chama `refresh()` uma vez e consulta o cadastro (`fetchCalls` 1); "Quem recebe" inicial = nome da conta; mudança do carrinho chega pelo `changes`.
- [x] 3.4 Testes de `canConfirm` no mesmo arquivo: cada condição de bloqueio da spec (carregando, falha, vazio, `isSyncing`, indisponível, sem cadastro, cadastro falhou) desabilita; tudo pronto habilita; os dois avisos aparecem só no caso deles.
- [x] 3.5 Testes de `confirm`: envia o nome e as instruções digitados; sucesso devolve `PlacedOrder` e chama `refresh()`; `holdPlace` mantém `running` e um segundo `execute` não envia.
- [x] 3.6 Testes de falha: `ORDER_CUSTOMER_INACTIVE` → mensagem, `refresh()` e nova consulta do cadastro; `ORDER_CART_HAS_UNAVAILABLE_ITEMS` → `refresh()` sem consultar o cadastro; `removeLine` com falha preenche `failureMessage`.

## 4. Tela do checkout

- [x] 4.1 Criar `CartSummary.checkout` em `cart_summary.dart` (Decisão 5) e testes em `cart_summary_test.dart`: "Entrega de bike", sem "Faltam…" nem aviso de indisponíveis.
- [x] 4.2 Criar em `lib/ui/modules/order/widgets/` `CheckoutStepCard`, `DeliveryStep`, `OrderNoteFields`, `PaymentStep`, `CheckoutLineTile` e `CheckoutSummary` (Decisão 5), só com tokens do tema.
- [x] 4.3 Criar `lib/ui/modules/order/pages/checkout_page.dart` com os callbacks `onOpenDeliveryDetails` (devolve `Future`), `onOpenStore` e `onOrderPlaced(id)`, e os textos como constantes públicas.
- [x] 4.4 Widget tests em `test/ui/modules/order/pages/checkout_page_test.dart`, dados de entrega: skeleton; banner "Não foi possível carregar seus dados." com "Tentar de novo"; sem cadastro → texto e "Preencher dados de entrega"; com cadastro → linha do endereço, telefone mascarado e "Alterar"; voltar da ação consulta de novo.
- [x] 4.5 Widget tests de resumo e pagamento: "Simulado" e o texto; linhas com "× n" e total; linha "Indisponível" com "Remover" chama `remove`; skeleton, banner do carrinho e vazio com "Voltar para a loja".
- [x] 4.6 Widget tests do rodapé: desabilitado sem cadastro com o aviso; habilitado com tudo pronto; tocar envia e mostra "Confirmando…"; sucesso mostra "Pedido #3F1C9A52 recebido" e chama `onOrderPlaced`; recusa mostra a mensagem e continua na tela.
- [x] 4.7 Criar `lib/ui/modules/order/pages/order_placed_page.dart` (Decisão 6) com widget test (número, texto e "Voltar para a loja").

## 5. Carrinho, dados de entrega e rotas

- [x] 5.1 Em `CartPage`, `onOpenCheckout` e o `_CheckoutBar` ligado (Decisão 7); em `cart_page_test.dart`: habilitado chama o callback; desabilitado com `isSyncing` e com indisponível.
- [x] 5.2 Em `DeliveryDetailsPage`, `onSaved` opcional chamado no `_save` depois de "Dados salvos", sem mudar `onBack`; teste em `delivery_details_page_test.dart` (chamado no sucesso, não na recusa).
- [x] 5.3 Em `AppRoutes`, `checkout`, `checkoutDelivery`, `orderLocation` e as duas entradas em `sessionRequiredPaths`; em `app_router.dart`, as três rotas filhas na aba Carrinho e os callbacks, com a `DeliveryDetailsPage` da rota do checkout recebendo `onBack` e `onSaved` com `pop` (Decisão 3).
- [x] 5.4 Atualizar `session_redirect_test.dart`, que hoje exige `{'/account/delivery'}`, para a lista nova (dados de entrega, checkout e pedido) e testar `/cart/checkout/delivery` e `/cart/orders/x` como protegidas.
- [x] 5.5 Testes em `app_router_test.dart`: sem sessão "Finalizar pedido" → `/login?from=/cart/checkout`; com sessão abre o checkout na aba Carrinho; "Alterar" abre os dados de entrega e salvar volta ao checkout.
- [x] 5.6 Teste em `app_router_test.dart`: confirmar com sucesso leva a `/cart/orders/<id>` e voltar mostra a aba Carrinho, sem o checkout.

## 6. CLAUDE.md e verificação final

- [x] 6.1 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 8 pede, sem afrouxar regra existente.
- [x] 6.2 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart`/`.g.dart` estão em dia.
- [x] 6.3 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 6.4 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [x] 6.5 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
