# Autorização da API Administrativa (Admin API Authorization) Specification

## Purpose

Define como a API do Jaja protege endpoints administrativos: a exigência combinada de token válido e da flag `admin`, as respostas `401` e `403`, o alcance da proteção (controller inteiro ou endpoint) e a garantia de que endpoints não administrativos seguem como estão.

## Requirements

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
A introdução da proteção administrativa MUST NOT alterar o acesso aos endpoints que não a declaram:
- `POST /auth/register` e `POST /auth/login` continuam públicos;
- `GET /auth/me` continua exigindo apenas token válido, de qualquer usuário;
- `GET /` continua acessível sem token.

Os endpoints de lojas seguem `stores/store-registration` e `stores/address-geocoding`: `/stores` e `/geocoding` são administrativos. Os endpoints de clientes seguem `customers/customer-registration`: `/customers` é administrativo, e `/me/customer` exige apenas token válido, de qualquer usuário. Os endpoints do carrinho seguem `orders/cart`: `/me/cart` exige apenas token válido, de qualquer usuário, e `POST /cart/preview` é público. Os endpoints do pedido do próprio cliente seguem `orders/order-placement`: `/me/orders` exige apenas token válido, de qualquer usuário. Os endpoints da administração de pedidos seguem `orders/order-admin` e `orders/order-monitor`: `/orders` é administrativo.

#### Scenario: Usuário comum no /auth/me
- **WHEN** um usuário com `admin = false` chama `GET /auth/me` com seu token
- **THEN** o sistema responde `200` com seus dados e `admin: false`

#### Scenario: Endpoint sem proteção
- **WHEN** um cliente sem token chama `GET /`
- **THEN** o sistema responde como antes desta entrega, sem `401` nem `403`

#### Scenario: Lojas deixam de ser públicas
- **WHEN** um cliente sem token chama `GET /stores`
- **THEN** o sistema responde `401`

#### Scenario: Geocodificação com token comum
- **WHEN** um usuário com `admin = false` chama `GET /geocoding?address=Avenida Paulista` com seu token
- **THEN** o sistema responde `403` com `ADMIN_REQUIRED`

#### Scenario: Clientes deixam de ser públicos
- **WHEN** um cliente sem token chama `GET /customers`
- **THEN** o sistema responde `401`

#### Scenario: Cadastro do próprio cliente com token comum
- **WHEN** um usuário com `admin = false` chama `GET /me/customer` com seu token
- **THEN** o sistema não responde `401` nem `403`

#### Scenario: Carrinho com token comum
- **WHEN** um usuário com `admin = false` chama `GET /me/cart` com seu token
- **THEN** o sistema responde `200` com o carrinho dele, sem `401` nem `403`

#### Scenario: Carrinho sem token
- **WHEN** um cliente sem token chama `GET /me/cart`
- **THEN** o sistema responde `401`

#### Scenario: Prévia do carrinho sem token
- **WHEN** um cliente sem token chama `POST /cart/preview`
- **THEN** o sistema responde `200`, sem `401` nem `403`

#### Scenario: Pedido com token comum
- **WHEN** um usuário com `admin = false` chama `GET /me/orders/:id` com seu token e o id de um pedido dele
- **THEN** o sistema responde `200` com o pedido, sem `401` nem `403`

#### Scenario: Pedido sem token
- **WHEN** um cliente sem token chama `POST /me/orders` ou `GET /me/orders/:id`
- **THEN** o sistema responde `401`

#### Scenario: Exemplo de pedidos removido
- **WHEN** um cliente sem token chama `GET /orders`
- **THEN** o sistema responde `401`, porque o endpoint de exemplo não existe mais e `/orders` passou a ser a lista administrativa de pedidos

#### Scenario: Pedidos administrativos com token comum
- **WHEN** um usuário com `admin = false` chama `GET /orders` com seu token
- **THEN** o sistema responde `403` com `ADMIN_REQUIRED`
