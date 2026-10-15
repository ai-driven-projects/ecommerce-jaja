## Context

Etapa 1 (arquivada) deixou `lib/core` com `Result`, `Command0/1`, `AppFailure` selada (inclusive `NetworkFailure`, `SessionFailure`, `BackendRejectionFailure(statusCode, codes)`, `NotFoundFailure`, `ServerFailure`, `UnexpectedFailure`), `GenericFailureCode.unspecified` e `resolveApiBaseUrl(AppEnvironment, {definedApiUrl})` → `Result<Uri>`, além da barreira de imports (`test/core/support/import_rules.dart`, regras A e B, `ImportRule`, constantes `infraPackages` etc.). A etapa 2 (aplicada em paralelo) entrega o tema e os componentes; o que esta change assume dela está em "Dependências da etapa anterior".

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

Assumido da change `mobile-app-02-tema-marca-mobile` (conferir no código entregue antes de aplicar; se um nome diferir, adaptar esta change ao que foi entregue, sem renomear o código da etapa 2):
- `lib/ui/shared/theme/app_theme.dart` com `AppTheme.light()` montando `ThemeData` Material 3; esta etapa acrescenta `navigationBarTheme` ali.
- `lib/ui/shared/theme/brand_tokens.dart` com `BrandTokens` e a extensão `context.tokens`, contendo pelo menos `card`, `line`, `brand`, `brandSoft` e `mutedInk`; `app_typography.dart` com `labelMedium`, `headlineSmall` e `bodyMedium` na escala da Decisão 3 dela.
- `lib/ui/shared/widgets/empty_state.dart` (`EmptyState` com emoji opcional, título, explicação e um botão com rótulo e ação obrigatórios) e `test/ui/shared/support/themed.dart`.
- `lib/main.dart` usando `AppTheme.light()` e `themeMode: ThemeMode.light`, e `test/main_test.dart` conferindo `BrandTokens` no tema — ambos substituídos aqui.
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

## Risks / Trade-offs

- [`get_it` é global e vaza estado entre testes] → todo teste que chama `configureDependencies` faz `resetDependencies` no `tearDown`.
- [Versões de `dio`/`go_router`/`get_it` incompatíveis com o SDK] → `flutter pub add` resolve; nunca `pub upgrade`.
- [Sem `lib/main.dart`, ferramentas que assumem o alvo padrão falham] → README e Makefile sempre com `-t`; nenhum comando de verificação depende do alvo.
- [`ConfigurationErrorApp` fora de `pages/`/`widgets/` não é coberto pela regra C] → usa só o tema por convenção; é uma tela única e pequena.
- [Requisição real não é exercitada no loop] → tudo passa pelo adapter fake do `dio`; teste em emulador fica fora do escopo.
