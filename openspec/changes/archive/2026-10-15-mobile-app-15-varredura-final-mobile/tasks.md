> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive o levantamento do Context) e as specs `mobile/mobile-architecture`, `mobile/mobile-navigation` e `mobile/mobile-core` desta change.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Nenhum texto de tela muda. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Falha inesperada única e código datado

- [x] 1.1 Declarar `unexpectedFailureMessage` e `unspecifiedFailure` em `lib/core/errors/app_failure.dart` (Decisão 1); teste do texto em `test/core/errors/app_failure_test.dart`.
- [x] 1.2 Usar a constante em `lib/core/command.dart`, `lib/infra/http/run_request.dart` e `lib/infra/http/http_failure_mapper.dart` (código `HttpFailureCode.unexpected` mantido); testes atuais desses arquivos seguem passando.
- [x] 1.3 Usar `unspecifiedFailure` em `order_tracking_view_model.dart`, `search_view_model.dart` e `product_detail_view_model.dart`; `grep -rn "Algo deu errado" lib` mostra só `app_failure.dart`.
- [x] 1.4 Reescrever os comentários de `lib/ui/shared/widgets/product_card.dart` e `empty_state.dart` sem citar etapa; `grep -rni "etapa [0-9]" lib` vazio.
- [x] 1.5 Repassar `lib/` por declarações sem consumidor (símbolos públicos, parâmetros opcionais nunca passados, membros privados sem uso que o analyzer não pega); remover o que não for exigido por spec e registrar no `design.md` o que foi removido ou mantido.

## 2. Textos de UI centralizados

- [x] 2.1 Criar `lib/ui/modules/cart/view_models/cart_texts.dart` (`CartTexts`) e usá-lo em `CartPage`, `CheckoutSummary`, `CartSummary` e `OrderItemsCard`, mantendo as constantes públicas antigas como apelidos (Decisão 2).
- [x] 2.2 Criar `lib/ui/modules/catalog/view_models/catalog_texts.dart` (`CatalogTexts`) e usá-lo em `SearchPage`, `ActiveFilterPills`, `FiltersSheet` e `HomePage`.
- [x] 2.3 Criar `lib/ui/modules/customer/view_models/customer_texts.dart` (`CustomerTexts`) e usá-lo em `DeliveryDetailsPage`, `DeliveryStep`, `CheckoutPage` e `AccountPage`.
- [x] 2.4 Criar `lib/ui/modules/order/view_models/order_texts.dart` (`OrderTexts`) e usá-lo em `OrderTrackingPage`, `CheckoutSummary`, `OrderNoteFields` e `OrderInstructionsCard`.
- [x] 2.5 Rodar `flutter test test/ui` e conferir que nenhum widget test mudou de expectativa (os textos são os mesmos).

## 3. Barreira: estrutura, cor e texto

- [x] 3.1 Criar `test/core/support/structure_rules.dart` (regra G, funções puras sobre caminhos) com as listas fechadas da spec e da Decisão 3.
- [x] 3.2 Testes da regra G em `architecture_test.dart`: pasta desconhecida em `lib/`, em `modules/<d>` e em `ui/modules/<d>`; domínio desconhecido; `*_test.dart` em `lib/`; teste sem espelho; `support/` aceito; e o teste sobre `lib/` e `test/` reais sem violação.
- [x] 3.3 Estender `isInlineStyleScoped` a todo `lib/app/` e acrescentar a regra C2 (cor só em `lib/ui/shared/theme/app_colors.dart`, sobre todo `lib/`) em `inline_style_rules.dart`.
- [x] 3.4 Testes de C estendida e C2: `TextStyle(` em `lib/app/` é violação; `Color(0x…)` em `app_colors.dart` aceito, em `app_theme.dart` e em `lib/infra/` violação; `Colors.transparent` e comentário aceitos; teste sobre o código real.
- [x] 3.5 Criar `test/core/support/ui_text_rules.dart` (regra H, com `analyzer`) conforme a Decisão 3.
- [x] 3.6 Testes da regra H: mesmo texto em dois arquivos é violação listando ambos; texto curto, minúsculo, interpolado, em import ou repetido no mesmo arquivo é aceito; `AdjacentStrings` juntado conta; teste sobre `lib/ui` e `lib/app` reais sem violação.

## 4. Testes de DI

- [x] 4.1 Em `test/infra/di/service_locator_test.dart`, teste que resolve depois de `configureDependencies` cada tipo pedido por `app_router.dart` e `bootstrap.dart` (Decisão 4).
- [x] 4.2 Teste irmão que extrai os `getIt<T>` de `lib/app/router/app_router.dart` e `lib/app/bootstrap.dart` como texto e confere que todos estão na lista do 4.1.
- [x] 4.3 Teste tabelado: cada ViewModel, `LoadDeliveryDetails` e `LiveOrderFeed` dão instâncias diferentes em dois pedidos; `Dio`, `KeyValueStore`, `SessionStorage` e cada repositório dão a mesma.

## 5. Testes de rotas

- [x] 5.1 Em `test/app/router/app_router_test.dart`, teste tabelado com sessão que abre cada caminho da Decisão 5 por `initialLocation` e confere a página e a aba selecionada.
- [x] 5.2 Teste tabelado sem sessão para `/login`, `/register` e `/splash` (sessão desconhecida) conferindo a tela cheia sem a barra.
- [x] 5.3 Teste tabelado sem sessão para cada `AppRoutes.sessionRequiredPaths` e `/cart/checkout/delivery`: termina em "Entrar" com `from` igual ao destino.
- [x] 5.4 Teste do toque na aba Início já selecionada com um produto aberto: volta à raiz (`/home`).
- [x] 5.5 Teste de `AppRoutes.splashLocation()` com e sem `from` em `test/app/router/session_redirect_test.dart`.

## 6. Documentação final

- [x] 6.1 Conferir em `apps/backend/src/modules/**` (controllers) e `modules/*/src` cada lacuna candidata da Decisão 6 e registrar no `design.md` as descartadas.
- [x] 6.2 Criar `apps/mobile/docs/lacunas-da-api.md` com os itens confirmados (o que falta, onde foi conferido, efeito, contorno) e a seção "Divergências do plano, não lacunas".
- [x] 6.3 Reescrever `apps/mobile/README.md` (Decisão 6): emulador e aparelho Android, simulador e aparelho iOS, `API_URL`, Makefile, verificação e problemas comuns; cada alvo citado existe no `Makefile`.
- [x] 6.4 Reescrever `apps/mobile/CLAUDE.md` com o estado final (Decisão 6): sem "Etapa N" nem "Página provisória", com as regras G, C2, H, os textos e a falha inesperada única.
- [x] 6.5 Conferir com `git diff apps/mobile/CLAUDE.md` que as 8 regras numeradas, as regras A–F e cada subitem de "Regras de domínio do app" continuam com o mesmo sentido; registrar no `design.md` qualquer mudança.

## 7. Verificação final

- [x] 7.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart`/`.g.dart` estão em dia.
- [x] 7.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 7.3 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart` com as regras G, C2 e H.
- [x] 7.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
