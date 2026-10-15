## Context

O app tem o shell de quatro abas (`buildAppRouter`, um `StatefulShellBranch` por aba, `/` → `/home`), o cliente `dio` de `createApiClient` (sem interceptor; o comentário reserva o Bearer para esta etapa), `runRequest` + `mapHttpFailure` (`401` → `SessionFailure`, outros `4xx` → `BackendRejectionFailure` com `codes`), o `Command0/1`, o `KeyValueStore` e a DI em `configureDependencies` + `registerViewModels()`. A aba Conta é a `AccountPage` provisória (`PlaceholderBody`). O `flutter_secure_storage` ainda não está no `pubspec.yaml`, mas a barreira (regra B) já o confina a `lib/infra`.

Regras do `CLAUDE.md` que moldam o desenho: `ui/` importa só `core/` e `modules/`; contrato que transporta estado técnico (a sessão JWT, com os estados `unknown`/`authenticated`/`anonymous`) mora em `lib/infra/auth/`; estado global de sessão é um repositório em `infra/` exposto como `ChangeNotifier`/`Stream`; regra sobre valor vira value object em `core/value_objects/`.

Referência de comportamento (só leitura): `apps/frontend/src/modules/auth/{data,components,pages}` (`auth.context.tsx`, `auth.api.ts`, `auth-storage.ts`, `first-name.util.ts`, `login.schema.ts`, `register.schema.ts`, `storefront-login.page.tsx`), `apps/frontend/src/shared/util/api-client.util.ts` e `shared/i18n/messages.pt.ts` (mensagens). Contrato: `AuthController` (`apps/backend/src/modules/auth/auth.controller.ts`), `UserDTO` (`modules/auth/src/user/dto`), `UserErrors` e `mapPayloadToAuthenticatedUser` (o `/auth/me` devolve `id`, `name`, `email`, `admin`, sem `avatarUrl`). Validações: `packages/shared/src/vo/{email,person-name,strong-password}.vo.ts`.

## Goals / Non-Goals

**Goals:** sessão completa por e-mail e senha (entrar, criar conta, restaurar, sair, expirar no `401`), guarda de rotas com retorno ao destino, splash e a aba Conta real.

**Non-Goals (ficam para outras etapas):**
- Merge do carrinho anônimo no login e volta ao anônimo vazio no logout — etapa 10 (escuta o mesmo repositório de sessão).
- "Minha conta" (dados de entrega) na aba Conta — etapa 11; checkout com sessão obrigatória — etapa 12; pedido — etapa 13. Cada uma acrescenta a sua rota à lista de rotas que exigem sessão.
- Testes finais de DI e de rotas e README — etapa 15.
- Fora do plano: Google e outros provedores, recuperação/troca de senha, "Área administrativa" (o app não tem admin), avatar.

## Decisions

### 1. Validações no núcleo (`lib/core/value_objects/`)
`email.dart`, `person_name.dart` e `strong_password.dart`, no molde de erro do `Money` (construtor privado, `static Result<T> create(String)`, `value`, igualdade por valor), com a origem (`*.vo.ts` e `messages.pt.ts`) no comentário. Regras copiadas na mesma ordem do TS:
- `Email`: apara e põe em minúsculas, `^[^\s@]+@[^\s@]+\.[^\s@]+$`; vazio também é "E-mail inválido." (o web mostra a mesma mensagem).
- `PersonName`: apara; `< 3` curto; `> 50` longo; menos de 2 palavras → sem sobrenome; primeira ou última com menos de 2 letras → curto; fora de `^[A-Za-zÀ-ÖØ-öø-ÿ'`´^~\- ]+$` → sem sobrenome (é o que o TS faz). `maxLength = 50` público, usado no campo.
- `StrongPassword`: `>= 8`, `[A-Z]`, `[a-z]`, `[0-9]`, `[^A-Za-z0-9]`; não apara.
- Códigos novos em `app_failure.dart`, ao lado de `MoneyCode`: `EmailCode { invalid }`, `PersonNameCode { tooShort, tooLong, surnameMissing }`, `PasswordCode { tooWeak }`. Falha sempre `ValidationFailure`.
- A confirmação de senha não é VO (compara dois campos): fica no ViewModel de cadastro.

### 2. Domínio `auth` (`lib/modules/auth/`)
- `model/auth_user_entity.dart` (`freezed` v3, com `const AuthUser._()`): `id`, `name`, `email`, `isAdmin`, e o getter `firstName` (primeira palavra do nome aparado, ou o nome inteiro; `first-name.util.ts`).
- `provider/auth_repository.dart`: `AuthUser? get currentUser`, `Stream<AuthUser?> get userChanges` (broadcast, emite a cada entrada/saída/expiração), `Future<Result<AuthUser>> signIn(Email, StrongPassword)`, `Future<Result<AuthUser>> signUp(PersonName, Email, StrongPassword)`, `Future<void> signOut()`. Os VOs na assinatura garantem que ninguém chama a API sem validar. Sem use case (regra 4): o cadastro seguido de login é do mesmo repositório.
- `errors/auth_errors.dart`: `enum AuthErrorCode { invalidCredentials, emailAlreadyExists, signInFailed, signUpFailed }` e as mensagens: "E-mail ou senha inválidos.", "Este e-mail já está cadastrado.", "Não foi possível entrar. Tente novamente.", "Não foi possível criar a conta. Tente novamente.".
- Por que o usuário vai para o domínio e o estado não: as telas precisam do usuário e das ações (domínio, regra 2); o token e o `SessionStatus` são estado técnico, usados só pelo router e pelo interceptor, e ficam em `infra/auth/` como o `CLAUDE.md` manda.

### 3. Sessão (`lib/infra/auth/`)
- `session_status.dart`: `enum SessionStatus { unknown, authenticated, anonymous }`.
- `session.dart`: `abstract interface class Session implements Listenable { SessionStatus get status; String? get token; void expire(); }`, o contrato técnico do router e do interceptor.
- `session_storage.dart` (`SessionStorage`: `read()`, `write(String)`, `clear()`, que nunca lançam, como o `KeyValueStore`) e `secure_session_storage.dart` (`FlutterSecureStorage`, chave `jaja:sessao`; qualquer exceção vira leitura `null` / gravação ignorada).
- `session_repository.dart`: `SessionRepository extends ChangeNotifier implements Session, AuthRepository`, recebendo `Dio` e `SessionStorage`. Nasce `unknown`.
  - `restore()` (uma vez, chamada pelo bootstrap): sem conteúdo → `anonymous`. Conteúdo ilegível → `clear()` e `anonymous`. Com sessão → `GET /auth/me` com `Authorization: Bearer <guardado>` explícito nas `Options` (o token ainda não está em memória): `Ok` → `authenticated` com o usuário novo e grava de novo; `SessionFailure` → `clear()` e `anonymous`; qualquer outra falha → `authenticated` com o usuário guardado (o web confia no cookie sem conferir; um `401` posterior encerra).
  - `signIn`: `POST /auth/login` `{email, password}`. `SessionFailure` (o `401` de `INVALID_CREDENTIALS`) → `BackendRejectionFailure(statusCode: 401, codes: ['INVALID_CREDENTIALS'], code: invalidCredentials)`; outra `BackendRejectionFailure` → mesma forma com `signInFailed`; rede, servidor e inesperada passam como vieram. No `Ok`: grava, `authenticated`, avisa (`notifyListeners` + `userChanges`).
  - `signUp`: `POST /auth/register` `{name, email, password}` (201 sem corpo; `admin` nunca vai); recusa com `EMAIL_ALREADY_EXISTS` em `codes` → `emailAlreadyExists`, outra recusa → `signUpFailed`; aceito → `signIn` com as mesmas credenciais e devolve o resultado dele.
  - `signOut()` e `expire()`: `clear()`, zera token e usuário, `anonymous`, avisa. `expire()` só age em `authenticated` (no `unknown` quem decide é o `restore`).
- `dispose()` fecha o `StreamController`.

### 4. DTOs (`lib/infra/api/auth_dto.dart`)
No molde de `storefront_product_dto.dart` (casts estritos, `FormatException` com o nome do campo, extras ignorados): `parseAuthUser(Object?)` (`id`, `name`, `email` texto; `admin` booleano; `avatarUrl` ignorado), `parseLoginResponse(Object?)` → `StoredSession(token, user)` (token vazio é erro) e `StoredSession.encode()`/`decodeStoredSession(String)` para o armazenamento, no formato `{"token": …, "user": {"id", "name", "email", "admin"}}` (o mesmo `AuthSession` do cookie do web). JSON de exemplo em `test/infra/api/support/auth_json.dart`.

### 5. Interceptor (`lib/infra/http/auth_interceptor.dart`)
`AuthInterceptor({required String? Function() readToken, required void Function() onUnauthorized})`:
- `onRequest`: sem `Authorization` na requisição e com token → `Bearer <token>`.
- `onError`: `401` numa requisição cujo `Authorization` é exatamente `Bearer <token atual>` → `onUnauthorized()`; sempre `handler.next(err)`, para o `runRequest` devolver a `SessionFailure`. Isso exclui o login (sem token) e o `/auth/me` do `restore` (token ainda fora da memória).
- Ligação na DI, sem ciclo: `createApiClient(url)..interceptors.add(AuthInterceptor(readToken: () => getIt<Session>().token, onUnauthorized: () => getIt<Session>().expire()))`. Os fechamentos resolvem o `getIt` na hora da requisição. `api_client.dart` só perde o comentário "entra na etapa da sessão".

### 6. DI e bootstrap
- `configureDependencies`: `SessionStorage` → `SecureSessionStorage`; `SessionRepository` lazy singleton (com `dispose`); `Session` e `AuthRepository` apontando para a mesma instância (`() => getIt<SessionRepository>()`).
- `registerViewModels()`: `LoginViewModel`, `RegisterViewModel` e `AccountViewModel`, cada um sobre `AuthRepository`.
- `createRootWidget`: depois de `configureDependencies`, `unawaited(getIt<SessionRepository>().restore())`; o app abre no splash e segue quando a sessão é conhecida.

### 7. Rotas e guarda (`lib/app/router/`)
- `AppRoutes`: `splash = '/splash'`, `login = '/login'`, `register = '/register'`, `fromParam = 'from'`, `loginLocation({String? from})`, `registerLocation({String? from})`, `const Set<String> sessionRequiredPaths = {}` e `requiresSession(path)` (igual ou prefixo `p/`). As três rotas novas ficam fora do `StatefulShellRoute` (tela cheia, sem barra).
- `session_redirect.dart`: função pura `resolveSessionRedirect({required SessionStatus status, required Uri uri, bool Function(String) requiresSession = AppRoutes.requiresSession})` e `safeReturnLocation(String?)` (aceita só `/…` sem `//` e cujo caminho não é splash, login nem cadastro; senão `null`). Ordem:
  1. `unknown`: fora do splash → `/splash?from=<uri>`; no splash → `null`.
  2. No splash com sessão conhecida → `safe(from) ?? /home`.
  3. `authenticated` em login ou cadastro → `safe(from) ?? /home` (conclui o acesso: o `notifyListeners` do repositório refaz o redirect; a página não navega).
  4. `anonymous` em rota que exige sessão → `/login?from=<uri>` (também cobre a expiração no meio do uso).
- `buildAppRouter`: `refreshListenable: getIt<Session>()` e `redirect` = `/` → `/home`, senão `resolveSessionRedirect`. O `app/router` passa a importar `infra/auth/session.dart` e `session_status.dart`; o `CLAUDE.md` registra essa permissão (é o caso previsto pela regra 2).
- Builders: `LoginPage(loginViewModelFactory, onClose, onOpenRegister)` e `RegisterPage(registerViewModelFactory, onClose, onOpenLogin)`; `onClose` = `context.canPop() ? context.pop() : context.go(AppRoutes.home)`; trocar de tela é `pushReplacement` com o mesmo `from`. `AccountPage(accountViewModelFactory, onOpenLogin, onOpenRegister)` empilha `loginLocation(from: AppRoutes.account)` / `registerLocation(from: AppRoutes.account)`.

### 8. Telas (`lib/ui/modules/auth/` e `lib/ui/shared/pages/`)
- `SplashPage` (`ui/shared/pages/`, sem ViewModel): "Jajá" em `displaySmall` cor `brand` e `CircularProgressIndicator` com a cor da marca, `Semantics(label: 'Carregando')`.
- `LoginViewModel(AuthRepository)`: `email`/`password` com `updateX`, `emailError`/`passwordError` (só depois da primeira tentativa, recalculados a cada mudança, como o `reValidateMode` do formulário web), `submit: Command0<AuthUser>` (valida; inválido → marca a tentativa e devolve a `ValidationFailure` sem chamar a API) e `formError` (mensagem do último resultado que falhou, exceto validação). `RegisterViewModel` igual, com `name` e `confirmPassword` ("As senhas não conferem.").
- `LoginPage`/`RegisterPage` (`WatchingStatefulWidget`, molde da `HomePage`): `Scaffold` com `AppBar(leading: CloseButton)`, `ListView` padding 16: título em `headlineSmall` ("Entrar" / "Criar conta"), `AppTextField`s (E-mail com dica `voce@empresa.com`, teclado de e-mail e `AutofillHints.email`; Senha com `obscureText` e dica `••••••••`; Nome com dica "Nome e sobrenome" e `maxLength: PersonName.maxLength`; Confirmar senha), `formError` em `bodySmall` cor `danger`, `AppButton(size: xl, expand: true)` com "Entrando…"/"Criando conta…" e `onPressed: null` durante a execução, e o link (`TextButton`) para a outra tela. No sucesso a página mostra o `SnackBar` pelo `ScaffoldMessenger` capturado **antes** do `await` (a guarda troca a rota logo depois). Textos como constantes públicas das páginas.
- `AccountViewModel(AuthRepository)`: `user` (do `currentUser`, atualizado por `userChanges`; cancela a assinatura no `dispose`) e `signOut: Command0<void>`.
- `AccountPage` (reescrita, sem `PlaceholderBody`, que continua na `CartPage`): sem sessão, título em `displaySmall`, texto em `mutedInk`, as três vantagens com "✓" num círculo `successSoft`/`success`, `AppButton` primário "Entrar" e secundário "Criar conta" (`expand`); com sessão, "Olá, <primeiro nome>" em `headlineSmall`, nome, e-mail ou "Administrador", e `AppButton` contorno "Sair" → `SnackBar` "Até já já.".

### 9. Testes e fakes
- `test/infra/auth/support/fake_session_storage.dart` (memória, conta gravações e limpezas) e `test/modules/auth/support/fake_auth_repository.dart` (`FakeAuthRepository extends ChangeNotifier implements AuthRepository, Session`, com estado e resultados programáveis, `holdSignIn()` com `Completer`, e chamadas gravadas; `signIn`/`signUp` de sucesso e `signOut` mudam o estado e avisam como o real, para a guarda agir nos testes de rota). `test/modules/auth/support/auth_fixtures.dart`: `ana` (Ana Souza, não admin) e `admin`.
- `registerFakeDependencies` ganha `FakeAuthRepository? auth` (padrão: `anonymous`) e o registra como `Session` e `AuthRepository`; os testes existentes não mudam de expectativa.
- O `SessionRepository` é testado com `Dio` + `FakeHttpClientAdapter` + `FakeSessionStorage`; o interceptor, com um `Dio` real, adapter fake e fechamentos de teste; o `SecureSessionStorage`, com `FlutterSecureStorage.setMockInitialValues`.

### 10. `CLAUDE.md`
Só acréscimos: "Etapa 8" no estado atual; na tabela de camadas, `app/` pode importar `infra/auth/` (estado da sessão para a guarda); em "Infraestrutura", o interceptor, o `Session` e a regra "rota nova que exige sessão entra em `AppRoutes.sessionRequiredPaths`"; em "Regras de domínio › Sessão", os textos de erro, o `from` e a restauração com `/auth/me`.

## Dependências da etapa anterior

Conferido no código entregue pela change `mobile-app-07-detalhe-produto-mobile` (arquivada), todos com o nome abaixo; se algo mudar até a aplicação, adaptar sem renomear o que existe e registrar abaixo:
- `app_router.dart` com as rotas filhas `product/:slug` de `/home` e `/search` montando `ProductDetailPage`; o arquivo `pages/product_page.dart` foi apagado. Esta etapa só acrescenta rotas de nível superior, `refreshListenable` e o redirect, sem tocar nessas rotas.
- `registerViewModels()` com `ProductDetailViewModel` registrado; esta etapa acrescenta três ViewModels ao final.
- `registerFakeDependencies({storeRepository, catalogRepository})` sem parâmetro novo da etapa 7 (o `FakeCatalogRepository` padrão devolve `plainDetail`); esta etapa acrescenta `auth`.
- `test/app/router/app_router_test.dart` esperando a `ProductDetailPage` nas duas pilhas (o `app_test.dart` não a menciona); com a sessão fake `anonymous`, essas expectativas seguem iguais.
- `CLAUDE.md` com o "Etapa 7" no estado atual; os acréscimos desta etapa vêm depois dele.
- Das etapas 1 a 6 (conferido no código): `AppTextField(label, controller, onChanged, hintText, errorText, keyboardType, textInputAction, obscureText, maxLength, enabled, autofillHints)`, `AppButton(label, onPressed, variant, size, icon, expand)` com `AppButtonVariant.{primary, secondary, outline}` e `AppButtonSize.xl`, `context.tokens` com `brand`, `mutedInk`, `danger`, `success`, `successSoft`, `textTheme.{displaySmall, headlineSmall, bodySmall}`, `runRequest`, `mapHttpFailure`, `FakeHttpClientAdapter(requests, enqueueResponse, enqueueError)`, `Command0`, `PlaceholderBody` (ainda usado pela `CartPage`).

## Decisões tomadas sem consulta

- O login valida a senha como senha forte, igual ao `login.schema.ts` do web (que usa `StrongPassword`), mesmo sendo um login.
- Parâmetro de destino `from` (o nome do app modelo, código em inglês), no lugar do `voltar` do web; destino inválido ou ausente vai para `/home` (o `/` do web).
- A aba Conta não exige sessão: sem sessão ela mostra o convite (padrão de app, e "Sair" mantém a pessoa na aba, como o web mantém na página). A lista de rotas que exigem sessão nasce vazia; as etapas 11 a 13 a preenchem. A guarda é testada pela função pura com uma lista de teste.
- "Entrar" e "Criar conta" são duas telas (uma ação principal por tela), não as abas do web.
- Textos com "e-mail" e ponto final ("E-mail ou senha inválidos.", "Este e-mail já está cadastrado."), como os demais textos do app, no lugar de "Email ou senha inválidos" do web.
- Na abertura sem rede, a sessão guardada continua ativa com o usuário guardado; só o `401` a apaga.
- Sessão guardada como JSON `{token, user}` numa chave do armazenamento seguro, como o cookie do web; sem decodificar o JWT no aparelho (a validade é do servidor).
- Sem botão de mostrar a senha: o `AppTextField` não tem ícone no fim e acrescentá-lo não é pedido pela etapa.
- Saudação "Olá, <primeiro nome>" na aba Conta (o web usa "olá, <nome>" no cabeçalho); "Conta do escritório" e "Minha conta" não entram (a segunda é da etapa 11).
- Nenhuma lacuna de API encontrada: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [O redirect conclui o acesso e desmonta a página antes do `SnackBar`] → `ScaffoldMessenger` capturado antes do `await`; teste de widget confere a mensagem depois da troca de rota.
- [Ciclo `Dio` ↔ sessão na DI] → o interceptor recebe fechamentos que resolvem o `getIt` só na hora da requisição; teste da DI resolve `Dio` e `Session` sem erro.
- [Plugin do armazenamento seguro ausente no `flutter_test`] → `SecureSessionStorage` engole exceções e os testes usam `FlutterSecureStorage.setMockInitialValues` ou o fake; o `bootstrap_test` passa a chamar o mock antes de montar o app.
- [Splash a cada abertura com sessão guardada e rede lenta] → no máximo os tempos do cliente (5 s de conexão, 10 s de resposta); depois segue com o usuário guardado.
- [Lista de rotas protegidas vazia parecer código morto] → é o ponto de extensão das etapas 11 a 13, registrado no `CLAUDE.md`, e coberto por teste da função pura.
