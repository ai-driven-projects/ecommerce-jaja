## Context

Etapa 1 (arquivada) deixou `lib/core` com `Result`, `Command0/1`, `AppFailure` selada (inclusive `NetworkFailure`, `SessionFailure`, `BackendRejectionFailure(statusCode, codes)`, `NotFoundFailure`, `ServerFailure`, `UnexpectedFailure`), `GenericFailureCode.unspecified` e `resolveApiBaseUrl(AppEnvironment, {definedApiUrl})` → `Result<Uri>`, além da barreira de imports (`test/core/support/import_rules.dart`, regras A e B, `ImportRule`, constantes `infraPackages` etc.). A etapa 2 (entregue) trouxe o tema e os componentes; o que esta change usa dela está em "Dependências da etapa anterior".

O backend responde erro como `ApiErrorResponse` (`apps/backend/src/shared/errors/api-error-response.type.ts`): `{ statusCode, error, message: string[], details?, path?, timestamp }`, com códigos de negócio em `message`. O web (`apps/frontend/src/shared/util/api-client.util.ts`) guarda esses códigos em `ApiError.codes` e traduz a mensagem por um dicionário. O desenho de cliente, DI, bootstrap e shell vem do app modelo (`/Users/leonardomleitao/Desktop/1-projetos/git/formacaodev/plataforma/apps/mobile`: `lib/infra/http/{dio_client,http_failure_mapper}.dart`, `lib/infra/di/service_locator.dart`, `lib/app/{bootstrap,app}.dart`, `lib/app/router/app_router.dart`, `lib/ui/shared/widgets/app_navigation_shell.dart`, `Makefile`), sem Firebase, flavors nem domínio de cursos.

## Goals / Non-Goals

**Goals:** cliente HTTP e mapeador de falhas testados com adapter fake; `runRequest` para os repositórios futuros; DI mínima; entrypoints dev/prod com tela de erro de configuração; shell de quatro abas com placeholders e rota "não encontrada"; regra D na barreira (`get_it`); Makefile e README com `adb reverse`.

**Non-Goals (ficam para outras etapas):**
- Interceptor Bearer, `flutter_secure_storage`, estados de sessão, splash, guarda do router e preservação do destino (`?from=`) — etapa 8.
- `watch_it`, ViewModels e `registerFactory` de telas — etapa 4 (primeiro ViewModel).
- Tradução de códigos do backend em mensagens específicas (`CART_ITEMS_LIMIT_EXCEEDED` etc.) — etapas 8, 10 e 12, cada uma para os códigos que consome.
- Leitura de stream SSE com o `dio` — etapa 14. Badge da aba Carrinho — etapa 9.
- Tema de `AppBar` e bottom sheet — quando o primeiro nascer (etapas 4 e 6).
- README completo (aparelho, iOS, lacunas) e `docs/lacunas-da-api.md` — etapa 15 / primeira lacuna.

## Decisions

### 1. Mapeador de falhas
`lib/infra/http/http_failure_mapper.dart` com `AppFailure mapHttpFailure(DioException)`:
- `connectionTimeout`, `sendTimeout`, `receiveTimeout` → `NetworkFailure` (`HttpFailureCode.timeout`); `connectionError` e `badCertificate` → `NetworkFailure` (`noConnection`). Mensagem única "Não foi possível falar com o servidor. Tente novamente." (`NETWORK_ERROR_MESSAGE` do web).
- `badResponse` pelo status: 401 → `SessionFailure` (`sessionExpired`, "Sua sessão expirou. Entre de novo."); 404 → `NotFoundFailure` (`notFound`, "Não encontramos o que você procurou."); outros 400–499 → `BackendRejectionFailure` (`rejected`, status, códigos, "Não foi possível concluir. Tente novamente." — `GENERIC_ERROR_MESSAGE` do web); ≥ 500 → `ServerFailure` (`server`, "O servidor está indisponível no momento. Tente novamente em instantes."); status ausente ou fora dessas faixas → inesperado.
- `cancel` e `unknown` → `UnexpectedFailure` (`unexpected`, "Algo deu errado. Tente novamente.", o mesmo texto do `Command`). A etapa 14 trata o cancelamento do stream antes de chegar aqui.
- Códigos: `response.data` pode ser `Map` (JSON decodificado), `String` (corpo não JSON) ou nulo. Só `Map` com `message` lista (filtrando não-textos) ou texto não vazio gera códigos; o resto, lista vazia. `details` é ignorado (só validação de admin o usa no web).
- `enum HttpFailureCode { noConnection, timeout, sessionExpired, notFound, rejected, server, unexpected }` entra em `lib/core/errors/app_failure.dart`, junto dos outros enums de código (a etapa 1 reservou isso para cá). Dart puro: não fere a regra A.
- Diferente do web, a mensagem **não** lista códigos desconhecidos ("Não foi possível concluir (X, Y)."): a spec `mobile-core` proíbe detalhe técnico na mensagem. Quem precisa de texto específico olha `codes`, como o web olha `ApiError.codes`.
- Alternativa descartada: dicionário completo de `messages.pt.ts` agora — ~180 códigos, a maioria de admin; cada etapa traz só os seus.

### 2. `runRequest`
`Future<Result<T>> runRequest<T>(Future<Response<Object?>> Function() send, T Function(Object? data) parse)` na mesma pasta `http/`: `DioException` → `Failure(mapHttpFailure(e))`; qualquer outro erro, inclusive `TypeError`/`FormatException` do `parse` → `Failure(UnexpectedFailure(...))`. É a fronteira de exceção da infraestrutura; repositórios das etapas 4+ só chamam `runRequest`. Para `204` o `parse` recebe `null`.

### 3. Cliente
`Dio createApiClient(Uri baseUrl)` em `lib/infra/http/api_client.dart`: `baseUrl` = `baseUrl.toString()`, `connectTimeout` 5 s e `receiveTimeout` 10 s (valores do modelo), `Accept: application/json`, `contentType` JSON, `responseType` JSON, `validateStatus` padrão (só 2xx é sucesso). Sem `sendTimeout` (o `dio` avisa quando a requisição não tem corpo) e sem interceptores: o Bearer é da etapa 8, que acrescenta o interceptor ao mesmo cliente.

### 4. DI
`lib/infra/di/service_locator.dart`: `final getIt = GetIt.instance`, `void configureDependencies({required Uri apiBaseUrl})` registra `Dio` como `registerLazySingleton` via `createApiClient`, e `Future<void> resetDependencies()` (`getIt.reset()`) para os testes. Comentário curto: ViewModels entram com `registerFactory`, estado global (sessão, carrinho) como singleton em `infra/`. Um registro duplicado lança (comportamento do `get_it`); o bootstrap chama uma vez só.

### 5. Entrypoints e bootstrap
- `lib/main_dev.dart` e `lib/main_prod.dart` só chamam `bootstrap(AppEnvironment.dev|prod)`. `lib/main.dart` é apagado (o modelo também não tem); `flutter run` passa a exigir `-t`, coberto pelo Makefile e pelo README.
- `lib/app/bootstrap.dart`: `bootstrap(env)` faz `WidgetsFlutterBinding.ensureInitialized()` e `runApp(createRootWidget(resolveApiBaseUrl(env)))`. `Widget createRootWidget(Result<Uri>)` é a parte testável: `Ok` → `configureDependencies` e `JajaApp`; `Failure` → `ConfigurationErrorApp(failure)`, sem registrar nada.
- `lib/app/app.dart`: `JajaApp` (`StatefulWidget`) cria o `GoRouter` no estado (descartado no `dispose`) e devolve `MaterialApp.router(title: 'Jajá', theme: AppTheme.light(), themeMode: ThemeMode.light, debugShowCheckedModeBanner: false)` — o tema que a etapa 2 pôs no `main.dart` muda para cá.
- `lib/app/configuration_error_app.dart`: `MaterialApp` com o mesmo tema e uma tela simples com "Não foi possível iniciar o app." e a `failure.message`, só com estilos do tema (embora fora de `pages/`/`widgets/`).

### 6. Rotas e shell
- `lib/app/router/app_routes.dart`: constantes `home = '/home'`, `search = '/search'`, `cart = '/cart'`, `account = '/account'` (caminhos em inglês, como o código; deep links estão fora do escopo).
- `lib/app/router/app_router.dart`: `GoRouter buildAppRouter({String initialLocation = AppRoutes.home})`, `redirect` de `/` para `/home`, `StatefulShellRoute.indexedStack` com um ramo por aba e `errorBuilder` → `NotFoundPage(onBackHome: () => context.go(AppRoutes.home))`. Os builders de rota é que vão buscar ViewModels no `getIt` (etapa 4+); por ora as páginas não têm dependência.
- `lib/ui/shared/widgets/app_navigation_shell.dart`: `Scaffold` com o `navigationShell` no corpo e `NavigationBar` com as quatro abas (ícones Material: `home`, `search`, `shopping_bag`, `person`, contornado quando inativo e cheio quando ativo). Tocar na aba ativa chama `goBranch(i, initialLocation: true)` (volta à raiz da aba, como o modelo). Linha superior de 1 px com `tokens.line`. O shell recebe o `StatefulNavigationShell`; não importa `app/`.
- Tema da barra em `AppTheme.light()` (`navigationBarTheme`): fundo `card`, `indicatorColor` `brandSoft`, sem `surfaceTint`, ícone e rótulo `brand` quando selecionado e `mutedInk` quando não, rótulo `labelMedium`, altura 64. A barra não tem referência no web nem nos mockups; os valores vêm dos tokens da etapa 2 (padrão de chip ativo).
- Placeholders: `HomePage` e `SearchPage` em `lib/ui/modules/catalog/pages/`, `CartPage` em `lib/ui/modules/cart/pages/`, `AccountPage` em `lib/ui/modules/auth/pages/` (a aba Conta nasce na etapa 8, de `auth`). Cada uma é `Scaffold` + `SafeArea` + `PlaceholderBody(title:)` (`lib/ui/shared/widgets/placeholder_body.dart`: título `headlineSmall` e "Em breve por aqui." em `bodyMedium`/`mutedInk`). Cada etapa troca a sua página; a 15 apaga o `PlaceholderBody` se sobrar.
- `NotFoundPage` em `lib/ui/shared/pages/not_found_page.dart`: `EmptyState` com emoji 🧭, "Página não encontrada", "Esse endereço não existe no app." e a ação "Voltar ao início". Recebe o callback para `ui/` não depender de `app/`.

### 7. Barreira: regra D
Em `import_rules.dart`, novo `ImportRule.locatorConfinement`: diretiva cujo pacote é `get_it` só é aceita se o arquivo estiver sob `lib/infra/di/` ou `lib/app/` (decidido pelo caminho, não só pela primeira pasta, porque `lib/infra/http` é proibido). Entra no conjunto padrão de `scanSource`/`scanDirectory`, com teste real sobre `lib` inteiro e testes sintéticos (ui, modules e infra/http violam; infra/di e app/router aceitam). `watch_it` reexporta o `get_it`: a etapa 4, que o adiciona, decide como a regra trata o `di` do `watch_it` (só estender, nunca afrouxar).

### 8. Android, Makefile e README
- `android/app/src/main/AndroidManifest.xml` ganha `android.permission.INTERNET`: o `flutter create` só a declara nos manifestos de debug/profile, e o app de produção precisa de rede.
- `Makefile` (sem `JAVA_HOME`, flavors nem targets de build/APK): `API_URL ?= http://localhost:4000`; `tunnel` (`-adb reverse tcp:4000 tcp:4000`); `run-dev`, `run-dev-tunnel` (tunnel + run-dev) e `run-prod` (`-t lib/main_prod.dart --dart-define=API_URL=$(API_URL)`); `codegen`, `analyze`, `test` e `check` (os três comandos de verificação).
- `README.md` em português no lugar do texto do `flutter create`: o que é o app, pré-requisitos (Flutter, backend em `apps/backend` na porta 4000), rodar no emulador Android com `adb reverse`, `API_URL` por `--dart-define` (padrão dev; produção exige), alvos do Makefile, verificação e link para o `CLAUDE.md`. Aparelho físico e iOS ficam numa linha cada; o README final é da etapa 15.

### 9. `CLAUDE.md`
Só acréscimos: em "Estado atual", que HTTP, DI e shell de abas existem; numa seção de infraestrutura, `runRequest`/`mapHttpFailure` como único caminho de chamada, a tabela de status → falha, `getIt` só em `infra/di` e `app/` (regra D), entrypoints com `-t`, rotas em `AppRoutes` e o padrão de página provisória.

## Dependências da etapa anterior

Da change `mobile-app-02-tema-marca-mobile`, conferido no código entregue (nenhum nome diferiu; se algo mudar até a aplicação, adaptar esta change, sem renomear o código da etapa 2):
- `lib/ui/shared/theme/app_theme.dart` com `AppTheme.light()` devolvendo um `ThemeData` Material 3 montado uma vez em `_buildLight()`; esta etapa acrescenta `navigationBarTheme` ali.
- `lib/ui/shared/theme/brand_tokens.dart` com `BrandTokens` e a extensão `context.tokens`, contendo pelo menos `card`, `line`, `brand`, `brandSoft` e `mutedInk`; `app_typography.dart` com `labelMedium`, `headlineSmall` e `bodyMedium` na escala da Decisão 3 dela.
- `lib/ui/shared/widgets/empty_state.dart` (`EmptyState({required title, required message, required actionLabel, required onAction, emoji = '📦'})`) e `test/ui/shared/support/themed.dart` (`themed(child)`: `MaterialApp` com o tema e `Scaffold`).
- `lib/main.dart` com `JajaApp` (`StatelessWidget`, `MaterialApp` com `AppTheme.light()`, `themeMode: ThemeMode.light` e `home: Scaffold()`), e `test/main_test.dart` conferindo `MaterialApp` e `BrandTokens` no tema — ambos substituídos aqui (`JajaApp` passa para `lib/app/app.dart`).
- Regra C (`test/core/support/inline_style_rules.dart`) ativa sobre `pages/` e `widgets/` de `lib/ui`: os arquivos novos dessas pastas precisam passar nela.
- Dependência `intl` já no `pubspec.yaml`; nenhuma das três desta etapa.

## Decisões tomadas sem consulta

- Caminhos de rota em inglês (`/home`, `/search`, `/cart`, `/account`) e `/` redirecionado para `/home`.
- Mensagens novas de falha: sessão "Sua sessão expirou. Entre de novo.", não encontrado "Não encontramos o que você procurou.", servidor "O servidor está indisponível no momento. Tente novamente em instantes."; rede e recusa copiadas do web.
- Códigos desconhecidos não aparecem na mensagem (diferença deliberada em relação ao web).
- `badCertificate` tratado como falha de rede; `cancel` como inesperado.
- `watch_it` não entra nesta etapa (sem consumidor); `get_it`, `dio` e `go_router` entram.
- Produção sem `API_URL` abre tela de erro de configuração em vez de lançar.
- Aba Conta como página de `auth`; Início e Buscar em `catalog`.
- `NotFoundPage` em `lib/ui/shared/pages/` (pasta nova em `ui/shared`), recebendo o callback de volta.
- Tema da barra de abas derivado dos tokens, sem referência visual no web nem nos mockups.
- Permissão `INTERNET` no manifesto principal do Android.
- Makefile sem targets de build de APK/IPA (publicação está fora do escopo).
- (Lote 1) Dependências da etapa 2 conferidas no código na aplicação: nenhum nome diferiu.
- (Lote 1) `flutter pub add` resolveu `dio ^5.11.1`, `get_it ^9.3.0` e `go_router ^17.5.0` (a 18 é incompatível com as restrições atuais; nada de `pub upgrade`).
- (Lote 1) Adapter fake em `test/infra/http/support/fake_http_client_adapter.dart`: `FakeHttpClientAdapter` com `requests` (as `RequestOptions` gravadas), `enqueueResponse({statusCode = 200, body, headers})` e `enqueueError(DioExceptionType)`. Corpo `Map`/`List` vai como JSON com `content-type: application/json`; `String` vai como está (sem esse cabeçalho, como um corpo HTML); `null` vira corpo vazio (usar com `204`). Sem resposta enfileirada, o `fetch` lança `StateError`. Os lotes 2 e 3 usam esse adapter com `createApiClient(...)..httpClientAdapter = adapter`.
- (Lote 2) O `dio` 5.11 tem `DioExceptionType.transformTimeout` (tempo esgotado ao converter a resposta), que a Decisão 1 não lista; entra junto dos outros tempos esgotados → `NetworkFailure`/`timeout`, para o `switch` seguir exaustivo sem curinga.
- (Lote 2) `badResponse` com status ausente ou abaixo de 400 → `UnexpectedFailure`/`unexpected`; ≥ 500 (inclusive acima de 599) → `ServerFailure`. Corpo `String` (HTML) num 4xx dá recusa com `codes` vazio. `codes` é uma lista não modificável.
- (Lote 2) `runRequest` captura `DioException` e, num `catch` genérico, todo o resto (inclusive `Error`), com a mesma `UnexpectedFailure` do mapeador (`HttpFailureCode.unexpected`). Com o adapter fake, `204` sem corpo chega ao `parse` como `null`. Os repositórios das etapas 4+ chamam `runRequest(() => dio.get<Object?>(...), parse)`.
- (Lote 3) Regra D em `import_rules.dart`: constantes `locatorPackage = 'get_it'` e `locatorAllowedPrefixes = {'infra/di/', 'app/'}`, comparadas com o caminho a partir de `lib/` (`_breaks` passou a receber `fromLib` além de `fromLayer`). Arquivo na raiz de `lib/` (ex.: `main_dev.dart`) que importe `get_it` é violação: os entrypoints só chamam `bootstrap` de `lib/app`. Como o conjunto padrão é `ImportRule.values`, a regra D entra automaticamente em `scanSource`/`scanDirectory` sem `rules`.
- (Lote 3) `test/infra/di/service_locator_test.dart` usa `tearDown(resetDependencies)`; os lotes seguintes (bootstrap) fazem o mesmo. A prova da 3.5 usou `lib/infra/http/api_client.dart`, que foi restaurado.
- (Lote 4) `navigationBarTheme` montado em `AppTheme._navigationBarTheme(textTheme)` com `AppColors` (não `BrandTokens`, como o resto de `app_theme.dart`): `height` 64, fundo `card`, `surfaceTintColor` transparente, `indicatorColor` `brandSoft`, `iconTheme`/`labelTextStyle` por `WidgetStateProperty` (`brand` selecionado, `mutedInk` nos demais; rótulo `labelMedium`).
- (Lote 4) Arquivos das páginas provisórias: `catalog/pages/{home_page,search_page}.dart`, `cart/pages/cart_page.dart`, `auth/pages/account_page.dart`. `PlaceholderBody.comingSoon` guarda "Em breve por aqui.".
- (Lote 4) `AppNavigationShell` é `StatelessWidget` (sem `PopScope` nem lógica de foco do modelo): `selectedIndex` = `navigationShell.currentIndex`, e a ordem dos destinos é a ordem dos ramos do router. A linha superior é um `DecoratedBox` em primeiro plano com `context.tokens.line`. Ícone de Buscar: `search_outlined`/`search`; de Conta: `person_outline`/`person`.
- (Lote 4) `go_router` é importado em `lib/ui/shared/widgets/app_navigation_shell.dart` (tipo `StatefulNavigationShell`); a barreira não restringe `go_router` em `ui/`. O `CLAUDE.md` (lote 6) deve citar essa exceção: em `ui/`, só o shell importa `go_router`.
- (Lote 4) `AppRoutes` é `abstract final class` com constantes. `buildAppRouter` redireciona quando `state.uri.path == '/'`; o `errorBuilder` usa `context.go(AppRoutes.home)`. `NotFoundPage` é `Scaffold` + `SafeArea` + `EmptyState` centralizado.
- (Lote 4) Widget tests novos: `test/ui/shared/widgets/placeholder_body_test.dart` e `test/ui/shared/pages/not_found_page_test.dart` (este monta `MaterialApp(home: NotFoundPage)` direto, porque a página já tem `Scaffold`). O teste da barra está em `test/ui/shared/theme/app_theme_test.dart`, que ainda importa `package:mobile/main.dart`: ao apagar o `main.dart` (5.2), o lote 5 troca esse import por `package:mobile/app/app.dart`.
- (Lote 5) `JajaApp` cria o router com `late final _router = buildAppRouter()` e o descarta no `dispose`; `bootstrap` é `void` (sem `await`: nada assíncrono antes do `runApp`). `createRootWidget` usa `switch` exaustivo sobre `Result<Uri>`. `ConfigurationErrorApp` mostra "Não foi possível iniciar o app." em `headlineSmall` e a `failure.message` em `bodyMedium`/`mutedInk`, centralizados, com `AppSpacing`.
- (Lote 5) `test/ui/shared/theme/app_theme_test.dart` passou a importar `package:mobile/app/app.dart` e a usar `find.byType(Scaffold).first` (o shell e a página têm cada um o seu `Scaffold`). Os testes de rota montam `MaterialApp.router(routerConfig: buildAppRouter(...))` com `addTearDown(router.dispose)` e leem o caminho em `router.routerDelegate.currentConfiguration.uri.path`; o toque em Carrinho procura o texto dentro do `NavigationBar` (a página provisória repete o título).
- (Lote 5) Permissão `INTERNET` declarada no topo do manifesto principal, com comentário. Makefile: `run-dev-tunnel` depende de `tunnel` e `run-dev` (sem receita própria); `check` = `codegen analyze test`. README cita aparelho físico Android (mesmo `adb reverse` por USB) e simulador iOS (`localhost` direto) numa linha cada.
- (Lote 5) `CLAUDE.md`: um parágrafo "Etapa 3" em "Estado atual" e a seção nova "Infraestrutura de HTTP, DI e rotas" antes de "Estado", com a tabela status → falha (inclui `transformTimeout` e status < 400 da decisão do lote 2) e a exceção do `go_router` no `AppNavigationShell`. Nada foi apagado.
- (Lote 6) Verificação final: `build_runner` termina com sucesso (0 saídas; avisa que `--delete-conflicting-outputs` foi removida e é ignorada nesta versão, sem efeito), `flutter analyze` sem problemas e `flutter test` com 183 testes passando. Nenhum `build/` nem `.dart_tool/` no `git status`. Fora de `apps/mobile/` e desta change aparecem só `openspec/loops/mobile-app/loop.json` (estado do loop, gravado pelo script) e `openspec/changes/mobile-app-04-seletor-loja-mobile/` (proposta da etapa seguinte); nenhum dos dois é desvio desta change e ambos ficaram intocados. Sem desvio do plano.

## Risks / Trade-offs

- [`get_it` é global e vaza estado entre testes] → todo teste que chama `configureDependencies` faz `resetDependencies` no `tearDown`.
- [Versões de `dio`/`go_router`/`get_it` incompatíveis com o SDK] → `flutter pub add` resolve; nunca `pub upgrade`.
- [Sem `lib/main.dart`, ferramentas que assumem o alvo padrão falham] → README e Makefile sempre com `-t`; nenhum comando de verificação depende do alvo.
- [`ConfigurationErrorApp` fora de `pages/`/`widgets/` não é coberto pela regra C] → usa só o tema por convenção; é uma tela única e pequena.
- [Requisição real não é exercitada no loop] → tudo passa pelo adapter fake do `dio`; teste em emulador fica fora do escopo.
