## Why

O app já mostra o catálogo inteiro (etapas 4 a 7), mas a aba Conta ainda é provisória e nenhuma requisição leva identidade: sem sessão não há carrinho da conta (etapa 10), dados de entrega (11), checkout (12) nem pedido (13). Esta é a etapa 8 de 15 do loop `mobile-app`, a primeira da fase Conta e carrinho: entrar e criar conta por e-mail e senha como a página `/entrar` da vitrine web (`storefront-login.page.tsx`, `login-form`/`register-form`, `auth.context.tsx`, specs `auth/storefront-access`, `auth/user-authentication` e `auth/user-registration`), com o token guardado no aparelho, enviado como Bearer e descartado no `401`.

## What Changes

- Validação no núcleo: e-mail, nome com sobrenome e senha forte, com as mesmas regras e mensagens dos value objects do pacote compartilhado usados pelo web.
- Domínio `auth`: o usuário autenticado (nome, e-mail, administrador, primeiro nome) e o contrato de entrar, criar conta (registro seguido de login, como o web), sair e observar o usuário atual.
- Infraestrutura: `POST /auth/login`, `POST /auth/register` e `GET /auth/me` com DTOs escritos à mão; sessão (token e usuário) guardada no `flutter_secure_storage`; repositório de sessão com os estados `unknown`/`authenticated`/`anonymous`, restaurado na abertura do app; interceptor que envia `Authorization: Bearer` e encerra a sessão quando uma requisição autenticada recebe `401`.
- Navegação: splash enquanto a sessão é desconhecida; guarda do `go_router` que leva ao login preservando o destino (`?from=`, o `?voltar=` do web), devolve ao destino depois de entrar e tira do login quem já tem sessão.
- Telas: "Entrar" e "Criar conta" em tela cheia, com validação no aparelho, erros da API no formulário e confirmação com o primeiro nome; aba Conta com dois estados (convite para entrar ou criar conta; nome, e-mail e "Sair").
- Testes de unidade (validações, DTOs, armazenamento, repositório de sessão, interceptor, redirecionamento) e widget tests das telas e das rotas.

## Capabilities

### New Capabilities
- `mobile/mobile-session`: sessão do cliente no app — entrar, criar conta, restaurar, sair, expirar no `401` e a aba Conta.

### Modified Capabilities
- `mobile/mobile-core`: acrescenta a validação de e-mail, nome e senha forte.
- `mobile/mobile-http`: acrescenta o envio do token como Bearer e o encerramento da sessão no `401`.
- `mobile/mobile-navigation`: acrescenta o splash e a guarda de sessão com retorno ao destino.

## Impact

- **Código:** só `apps/mobile/**`: `lib/core/`, `lib/modules/auth/`, `lib/infra/{api,auth,http,di}/`, `lib/ui/modules/auth/`, `lib/ui/shared/pages/`, `lib/app/`, `pubspec.yaml`, `CLAUDE.md` e `test/**`.
- **Dependências:** `flutter_secure_storage` (autorizado pelo plano, via `flutter pub add`).
- **API:** `POST /auth/login`, `POST /auth/register` e `GET /auth/me`, sem parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
