## Purpose

Define como a API do Jaja protege endpoints administrativos: a exigência combinada de token válido e da flag `admin`, as respostas `401` e `403`, o alcance da proteção (controller inteiro ou endpoint) e a garantia de que endpoints não administrativos seguem como estão.

## ADDED Requirements

### Requirement: Endpoints administrativos exigem token válido de administrador
Um endpoint marcado como administrativo SHALL exigir um token Bearer válido cujo usuário tenha `admin = true`. Sem token, com token expirado ou com assinatura inválida, o sistema MUST responder `401` sem executar o endpoint. Com token válido de usuário com `admin = false`, o sistema MUST responder `403` com o código `ADMIN_REQUIRED` no corpo de erro padrão da API, sem executar o endpoint. A verificação de token MUST acontecer antes da verificação de administrador, de modo que uma requisição sem token válido nunca receba `403`. A decisão MUST usar a flag `admin` carregada no token: uma mudança da flag no cadastro só vale após um novo login.

#### Scenario: Sem token
- **WHEN** um cliente chama um endpoint administrativo sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401` e o endpoint não é executado

#### Scenario: Token expirado ou adulterado
- **WHEN** um cliente chama um endpoint administrativo com um token expirado ou com a assinatura alterada
- **THEN** o sistema responde `401`, e não `403`

#### Scenario: Usuário comum
- **WHEN** um cliente chama um endpoint administrativo com o token válido de `ana.pereira.carvalho@jaja.dev` (`admin = false`)
- **THEN** o sistema responde `403` com o código `ADMIN_REQUIRED` e o endpoint não é executado

#### Scenario: Administrador
- **WHEN** um cliente chama um endpoint administrativo com o token válido de `admin@jaja.dev` (`admin = true`)
- **THEN** o endpoint é executado e responde normalmente, com o usuário autenticado disponível

### Requirement: Proteção declarada por controller ou por endpoint
A proteção administrativa SHALL poder ser aplicada a um controller inteiro, valendo para todos os seus endpoints, ou a endpoints individuais. Um endpoint administrativo MUST NOT ficar acessível sem token, mesmo que também esteja marcado como público: nesse caso o sistema MUST responder `401`.

#### Scenario: Controller administrativo
- **WHEN** um controller é marcado como administrativo e um usuário comum chama qualquer um de seus endpoints
- **THEN** todos respondem `403` com `ADMIN_REQUIRED`

#### Scenario: Marcação pública não abre endpoint administrativo
- **WHEN** um endpoint administrativo também marcado como público é chamado sem token
- **THEN** o sistema responde `401`

### Requirement: Endpoints não administrativos não mudam
A introdução da proteção administrativa MUST NOT alterar o acesso aos endpoints que não a declaram: `POST /auth/register` e `POST /auth/login` continuam públicos, `GET /auth/me` continua exigindo apenas token válido (de qualquer usuário) e `GET /`, `/catalog`, `/orders`, `/customers` e `/stores` continuam acessíveis sem token.

#### Scenario: Usuário comum no /auth/me
- **WHEN** um usuário com `admin = false` chama `GET /auth/me` com seu token
- **THEN** o sistema responde `200` com seus dados e `admin: false`

#### Scenario: Endpoint sem proteção
- **WHEN** um cliente sem token chama `GET /`
- **THEN** o sistema responde como antes desta entrega, sem `401` nem `403`
