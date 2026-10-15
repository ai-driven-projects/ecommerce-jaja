> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-http`, `mobile/mobile-navigation` e `mobile/mobile-architecture` desta change. Desenho de referência (só leitura): app modelo em `/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile` (arquivos citados no Context do design).
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; dependências só por `flutter pub add` (nunca `pub upgrade`); nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`.

## 1. Dependências e cliente HTTP

- [ ] 1.1 Conferir no código as dependências da etapa 2 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue.
- [ ] 1.2 `cd apps/mobile && flutter pub add dio get_it go_router`; conferir no `pubspec.yaml` e `flutter pub get` sem erro.
- [ ] 1.3 Acrescentar `enum HttpFailureCode` (Decisão 1) em `lib/core/errors/app_failure.dart`; `flutter test test/core` continua passando.
- [ ] 1.4 Criar `lib/infra/http/api_client.dart` com `createApiClient(Uri)` (Decisão 3).
- [ ] 1.5 Criar `test/infra/http/support/fake_http_client_adapter.dart`: `HttpClientAdapter` que grava as `RequestOptions` recebidas e devolve uma resposta enfileirada (status, corpo, cabeçalhos) ou lança um `DioException` do tipo pedido.
- [ ] 1.6 Testes em `test/infra/http/api_client_test.dart`: `baseUrl` `http://10.0.2.2:4000`, tempos 5 s/10 s, `GET /storefront/stores` sai para `http://10.0.2.2:4000/storefront/stores` com `Accept: application/json` (via adapter fake).

## 2. Mapeador de falhas e runRequest

- [ ] 2.1 Criar `lib/infra/http/http_failure_mapper.dart` com `mapHttpFailure(DioException)` e a extração de códigos (Decisão 1).
- [ ] 2.2 Criar `lib/infra/http/run_request.dart` com `runRequest<T>` (Decisão 2).
- [ ] 2.3 Testes de rede em `test/infra/http/http_failure_mapper_test.dart`: `connectionError` e `badCertificate` → `NetworkFailure`/`noConnection`; os três timeouts → `NetworkFailure`/`timeout`; mensagem igual à da spec.
- [ ] 2.4 Testes de status: 401 → `SessionFailure`; 404 → `NotFoundFailure`; 400 com `message` lista de dois códigos → recusa com status 400 e ordem preservada; 409 com `message` texto → um código; 422 sem corpo → códigos vazios; 500 e 503 com corpo HTML → `ServerFailure`.
- [ ] 2.5 Testes de borda: `message` com itens não-texto é filtrado; `cancel` e `unknown` → `UnexpectedFailure`; nenhuma mensagem contém o código recebido.
- [ ] 2.6 Testes em `test/infra/http/run_request_test.dart` com `createApiClient` + adapter fake: 200 parseado → `Ok`; `parse` que lança `TypeError` → `UnexpectedFailure` "Algo deu errado. Tente novamente."; conexão recusada → `NetworkFailure`; 400 → recusa com códigos; 204 entrega `null` ao `parse`.

## 3. DI e regra D da barreira

- [ ] 3.1 Criar `lib/infra/di/service_locator.dart` com `getIt`, `configureDependencies({required Uri apiBaseUrl})` e `resetDependencies()` (Decisão 4).
- [ ] 3.2 Testes em `test/infra/di/service_locator_test.dart` (`resetDependencies` no `tearDown`): depois de configurar, `getIt<Dio>()` existe, é sempre a mesma instância e tem o `baseUrl` dado.
- [ ] 3.3 Em `test/core/support/import_rules.dart`, acrescentar `ImportRule.locatorConfinement` (Decisão 7) ao conjunto padrão; em `architecture_test.dart`, o teste real da regra D sobre `lib`, exigindo ao menos um arquivo.
- [ ] 3.4 Testes sintéticos da regra D: `package:get_it/get_it.dart` em `lib/ui/modules/catalog/pages/x.dart`, `lib/modules/cart/x.dart` e `lib/infra/http/x.dart` são violação; em `lib/infra/di/x.dart` e `lib/app/router/x.dart` são aceitos.
- [ ] 3.5 Provar que a regra morde: importar temporariamente `get_it` num arquivo de `lib/infra/http/`, ver `flutter test test/core/architecture_test.dart` falhar com arquivo e linha, e desfazer.

## 4. Shell de abas e páginas

- [ ] 4.1 Em `lib/ui/shared/theme/app_theme.dart`, acrescentar o `navigationBarTheme` da Decisão 6 com tokens da marca.
- [ ] 4.2 Criar `lib/ui/shared/widgets/placeholder_body.dart` e as páginas provisórias `HomePage`, `SearchPage` (`ui/modules/catalog/pages/`), `CartPage` (`ui/modules/cart/pages/`) e `AccountPage` (`ui/modules/auth/pages/`), títulos "Início", "Buscar", "Carrinho", "Conta".
- [ ] 4.3 Criar `lib/ui/shared/pages/not_found_page.dart` (`EmptyState` com "Página não encontrada" e "Voltar ao início" chamando o callback recebido).
- [ ] 4.4 Criar `lib/ui/shared/widgets/app_navigation_shell.dart` (Decisão 6: quatro destinos, toque na aba ativa volta à raiz, linha superior `tokens.line`).
- [ ] 4.5 Criar `lib/app/router/app_routes.dart` e `lib/app/router/app_router.dart` com `buildAppRouter` (`StatefulShellRoute.indexedStack`, redirect de `/`, `errorBuilder`).
- [ ] 4.6 Testes de tema em `test/ui/shared/theme/`: `navigationBarTheme` com fundo `card`, indicador `brandSoft` e ícone selecionado `brand`; widget tests de `PlaceholderBody` e `NotFoundPage` (callback chamado uma vez).

## 5. App, bootstrap e entrypoints

- [ ] 5.1 Criar `lib/app/app.dart` (`JajaApp` com `MaterialApp.router`, tema da etapa 2, router criado e descartado no estado) e `lib/app/configuration_error_app.dart` (Decisão 5).
- [ ] 5.2 Criar `lib/app/bootstrap.dart` com `bootstrap(AppEnvironment)` e `createRootWidget(Result<Uri>)`; criar `lib/main_dev.dart` e `lib/main_prod.dart`; apagar `lib/main.dart`.
- [ ] 5.3 Trocar `test/main_test.dart` por `test/app/app_test.dart`: `JajaApp` tem `BrandTokens` no tema, título "Jajá" e abre na aba Início.
- [ ] 5.4 Testes de rotas em `test/app/router/app_router_test.dart`: barra com Início, Buscar, Carrinho e Conta nessa ordem e Início selecionada; tocar em Carrinho mostra `CartPage` e mantém `HomePage` montada fora da tela (`skipOffstage: false`); `/` vai para `/home`.
- [ ] 5.5 Testes de rota desconhecida: `buildAppRouter(initialLocation: '/nao-existe')` mostra "Página não encontrada"; tocar em "Voltar ao início" mostra `HomePage`.
- [ ] 5.6 Testes em `test/app/bootstrap_test.dart` (`resetDependencies` no `tearDown`): `createRootWidget(Ok(http://localhost:4000))` registra `Dio` com esse `baseUrl` e devolve `JajaApp`; com a falha de `resolveApiBaseUrl(AppEnvironment.prod, definedApiUrl: '')`, a tela mostra "Endereço da API não configurado.", nenhum `NavigationBar` e `getIt.isRegistered<Dio>()` é falso.

## 6. Android, Makefile, README e CLAUDE.md

- [ ] 6.1 Acrescentar `<uses-permission android:name="android.permission.INTERNET"/>` em `android/app/src/main/AndroidManifest.xml`; conferir com `grep`.
- [ ] 6.2 Criar `apps/mobile/Makefile` com os alvos da Decisão 8 (`tunnel` com `adb reverse tcp:4000 tcp:4000`, `run-dev`, `run-dev-tunnel`, `run-prod`, `codegen`, `analyze`, `test`, `check`); conferir com `make -n run-dev check`.
- [ ] 6.3 Reescrever `apps/mobile/README.md` em português conforme a Decisão 8; conferir que cita `adb reverse tcp:4000 tcp:4000`, `--dart-define=API_URL` e `lib/main_dev.dart`.
- [ ] 6.4 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 9 pede, sem apagar regra existente.

## 7. Verificação final

- [ ] 7.1 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso.
- [ ] 7.2 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [ ] 7.3 `cd apps/mobile && flutter test` com todos os testes passando.
- [ ] 7.4 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
