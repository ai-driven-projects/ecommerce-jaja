> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-session`, `mobile/mobile-core`, `mobile/mobile-http` e `mobile/mobile-navigation` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; única dependência nova é `flutter_secure_storage` (via `flutter pub add`, sem `pub upgrade`); nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Dependência e validações do núcleo

- [ ] 1.1 Conferir no código as dependências da etapa 7 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue.
- [ ] 1.2 `cd apps/mobile && flutter pub add flutter_secure_storage`; conferir que só `pubspec.yaml`/`pubspec.lock` mudaram.
- [ ] 1.3 Em `lib/core/errors/app_failure.dart`, acrescentar `EmailCode`, `PersonNameCode` e `PasswordCode` (Decisão 1).
- [ ] 1.4 Criar `lib/core/value_objects/email.dart` e testes em `test/core/value_objects/email_test.dart`: ` Ana@Exemplo.COM ` → `ana@exemplo.com`; `ana@`, `ana @x.com`, vazio → "E-mail inválido."; igualdade por valor.
- [ ] 1.5 Criar `person_name.dart` e testes: `Ana Souza` ok e aparado; `Ana` e `Ana 3` → "Informe nome e sobrenome."; `A Souza` e `Al` → curto; 51 caracteres → longo; `maxLength == 50`.
- [ ] 1.6 Criar `strong_password.dart` e testes: `#Senha123` ok; `Senha1234`, `#senha123`, `#SENHA123`, `#Senhaaaa`, `#Se1` → mensagem de senha forte; espaços não são aparados.

## 2. Domínio auth e DTOs

- [ ] 2.1 Criar `lib/modules/auth/model/auth_user_entity.dart` (Decisão 2), rodar o codegen e testar `firstName` em `test/modules/auth/model/auth_user_entity_test.dart` (`  Ana  Souza ` → `Ana`; nome de uma palavra → ele mesmo).
- [ ] 2.2 Criar `lib/modules/auth/provider/auth_repository.dart` e `lib/modules/auth/errors/auth_errors.dart` (Decisão 2); `flutter analyze` sem problemas.
- [ ] 2.3 Criar `test/modules/auth/support/auth_fixtures.dart` (`ana`, `admin`) e `fake_auth_repository.dart` (Decisão 9).
- [ ] 2.4 Criar `test/infra/api/support/auth_json.dart` com a resposta do login, o `/auth/me` (sem `avatarUrl`), um campo extra e variantes inválidas.
- [ ] 2.5 Criar `lib/infra/api/auth_dto.dart` (Decisão 4) e testes em `test/infra/api/auth_dto_test.dart`: login → token e usuário; `/auth/me` sem `avatarUrl`; `admin` ausente ou texto, token vazio → `FormatException` com o campo; `encode`/`decodeStoredSession` vão e voltam; texto ilegível → `FormatException`.

## 3. Armazenamento e repositório de sessão

- [ ] 3.1 Criar `lib/infra/auth/{session_status,session,session_storage,secure_session_storage}.dart` (Decisão 3).
- [ ] 3.2 Testes em `test/infra/auth/secure_session_storage_test.dart` com `FlutterSecureStorage.setMockInitialValues`: grava e lê de volta; chave ausente → `null`; `clear` apaga. Criar `test/infra/auth/support/fake_session_storage.dart`.
- [ ] 3.3 Criar `lib/infra/auth/session_repository.dart` (Decisão 3).
- [ ] 3.4 Testes de `restore` em `test/infra/auth/session_repository_test.dart`: nasce `unknown`; sem conteúdo → `anonymous` sem requisição; `/auth/me` `200` → `authenticated`, usuário novo gravado e `Bearer` do guardado no cabeçalho; `401` → `clear` e `anonymous`; rede → `authenticated` com o usuário guardado; conteúdo ilegível → `clear` e `anonymous`.
- [ ] 3.5 Testes de `signIn` no mesmo arquivo: corpo `{email, password}`; `Ok` grava, `authenticated`, avisa ouvintes e `userChanges`; `401` → `invalidCredentials` com "E-mail ou senha inválidos." sem gravar; `400` → `signInFailed`; rede passa a `NetworkFailure`.
- [ ] 3.6 Testes de `signUp`: corpo só `{name, email, password}` e depois o login; `409` `EMAIL_ALREADY_EXISTS` → `emailAlreadyExists` sem login; `400` → `signUpFailed`; registro ok e login com falha → falha do login, sem sessão.
- [ ] 3.7 Testes de `signOut` e `expire`: limpam o armazenamento, zeram token e usuário, `anonymous` e avisam; `expire` em `unknown` ou `anonymous` não faz nada.

## 4. Interceptor, DI e bootstrap

- [ ] 4.1 Criar `lib/infra/http/auth_interceptor.dart` (Decisão 5) e tirar o comentário do Bearer de `api_client.dart`.
- [ ] 4.2 Testes em `test/infra/http/auth_interceptor_test.dart` com `Dio` + `FakeHttpClientAdapter`: com token sai `Bearer abc`; sem token não sai `Authorization`; cabeçalho próprio mantido; `401` com o token atual chama `onUnauthorized` uma vez e `runRequest` devolve `SessionFailure`; `401` sem token ou com outro token não chama.
- [ ] 4.3 Em `service_locator.dart`, registrar storage, `SessionRepository`, `Session`, `AuthRepository` e o interceptor no `Dio` (Decisão 6); ViewModels entram no grupo 6.
- [ ] 4.4 Em `test/infra/di/service_locator_test.dart`: `Session`, `AuthRepository` e `SessionRepository` são a mesma instância; o `Dio` tem um `AuthInterceptor`; resolver `Dio` e `Session` não entra em ciclo.
- [ ] 4.5 Em `bootstrap.dart`, chamar `restore()` sem esperar (Decisão 6); em `test/app/bootstrap_test.dart`, chamar `FlutterSecureStorage.setMockInitialValues({})` e manter as expectativas (abre na Início, sem requisição de sessão).

## 5. Guarda e rotas

- [ ] 5.1 Em `app_routes.dart`, acrescentar `splash`, `login`, `register`, `fromParam`, `loginLocation`, `registerLocation`, `sessionRequiredPaths` e `requiresSession` (Decisão 7).
- [ ] 5.2 Criar `lib/app/router/session_redirect.dart` (Decisão 7).
- [ ] 5.3 Testes em `test/app/router/session_redirect_test.dart`: `unknown` em `/search?category=escolar` → `/splash?from=…` codificado; no splash `unknown` → `null`; splash conhecido → `from` ou `/home`; `authenticated` em login com `from` → `from`; `from` externo, `//x`, `/login` → `/home`; com `requiresSession` de teste, `anonymous` em `/x?y=1` → `/login?from=%2Fx%3Fy%3D1`; `anonymous` fora da lista → `null`.
- [ ] 5.4 Criar `lib/ui/shared/pages/splash_page.dart` (Decisão 8) e widget test: "Jajá", indicador e o rótulo "Carregando".
- [ ] 5.5 Em `app_router.dart`, `refreshListenable`, redirect, e as rotas de nível superior `/splash`, `/login` e `/register` (as páginas do grupo 7 entram ali; até lá, montar só o splash).

## 6. ViewModels

- [ ] 6.1 Criar `lib/ui/modules/auth/view_models/login_view_model.dart` (Decisão 8).
- [ ] 6.2 Testes em `test/ui/modules/auth/view_models/login_view_model_test.dart` com `FakeAuthRepository`: sem tentativa não há erro de campo; enviar inválido mostra os dois erros e não chama `signIn`; corrigir o campo apaga o erro; válido chama `signIn` com o e-mail normalizado; falha de credencial preenche `formError`; `ValidationFailure` não vai para `formError`.
- [ ] 6.3 Criar `register_view_model.dart` e testes: confirmação diferente → "As senhas não conferem." sem chamada; válido chama `signUp` com nome aparado; `emailAlreadyExists` em `formError`.
- [ ] 6.4 Criar `account_view_model.dart` e testes: `user` inicial do repositório; muda quando `userChanges` emite e avisa; `signOut` chama o repositório; `dispose` cancela a assinatura.
- [ ] 6.5 Em `registerViewModels()`, registrar os três; em `service_locator_test.dart`, cada `getIt<…ViewModel>()` é instância nova.

## 7. Telas

- [ ] 7.1 Criar `lib/ui/modules/auth/pages/login_page.dart` (Decisão 8).
- [ ] 7.2 Widget tests em `test/ui/modules/auth/pages/login_page_test.dart`: campos e botão; tocar "Entrar" vazio mostra as mensagens; `holdSignIn()` mostra "Entrando…" e botão inativo; recusa mostra "E-mail ou senha inválidos."; sucesso mostra "Bem-vindo, Ana"; fechar e "Criar conta" chamam os callbacks.
- [ ] 7.3 Criar `register_page.dart` e widget tests: quatro campos com `maxLength` 50 no nome; confirmação diferente; e-mail já cadastrado; sucesso mostra "Conta criada. Bem-vindo, Ana"; "Já tenho conta" chama o callback.
- [ ] 7.4 Reescrever `lib/ui/modules/auth/pages/account_page.dart` (Decisão 8), sem `PlaceholderBody`.
- [ ] 7.5 Widget tests em `test/ui/modules/auth/pages/account_page_test.dart`: sem sessão, título, texto, três vantagens, "Entrar" e "Criar conta" chamam os callbacks; com `ana`, "Olá, Ana", nome, e-mail e "Sair"; com `admin`, "Administrador"; "Sair" mostra "Até já já." e volta ao convite; a página troca de estado quando o fake emite.
- [ ] 7.6 Ligar as páginas no `app_router.dart` (builders da Decisão 7) e na rota da aba Conta.

## 8. Rotas no app, CLAUDE.md e verificação final

- [ ] 8.1 Em `test/app/support/fake_dependencies.dart`, aceitar `FakeAuthRepository? auth` (padrão `anonymous`) e registrá-lo como `Session` e `AuthRepository` (Decisão 9); `app_test.dart` segue passando.
- [ ] 8.2 Em `test/app/router/app_router_test.dart`: sessão `unknown` mostra o splash sem a barra e, ao virar `anonymous`, a Início; `/login?from=/search?category=escolar` com sessão vai para a Buscar filtrada.
- [ ] 8.3 No mesmo arquivo: na Conta sem sessão, "Entrar" abre a tela cheia, entrar com sucesso volta à Conta mostrando "Olá, Ana"; "Criar conta" a partir do login mantém o destino; fechar volta à Conta; `/login?from=https://exemplo.com` → Início depois de entrar.
- [ ] 8.4 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 10 pede, sem apagar regra existente.
- [ ] 8.5 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` estão em dia.
- [ ] 8.6 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [ ] 8.7 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [ ] 8.8 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
