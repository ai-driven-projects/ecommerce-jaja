## MODIFIED Requirements

### Requirement: Endpoints não administrativos não mudam
A introdução da proteção administrativa MUST NOT alterar o acesso aos endpoints que não a declaram:
- `POST /auth/register` e `POST /auth/login` continuam públicos;
- `GET /auth/me` continua exigindo apenas token válido, de qualquer usuário;
- `GET /` continua acessível sem token.

Os endpoints de lojas seguem `stores/store-registration`: `/stores` é administrativo. A geocodificação segue `stores/address-geocoding`: `/geocoding` exige apenas token válido, de qualquer usuário. As lojas da vitrine seguem `stores/storefront-stores`: `GET /storefront/stores` é público. Os endpoints de clientes seguem `customers/customer-registration`: `/customers` é administrativo, e `/me/customer` exige apenas token válido, de qualquer usuário. Os endpoints do carrinho seguem `orders/cart`: `/me/cart` exige apenas token válido, de qualquer usuário, e `POST /cart/preview` é público. Os endpoints do pedido do próprio cliente seguem `orders/order-placement`: `/me/orders` exige apenas token válido, de qualquer usuário. Os endpoints da administração de pedidos seguem `orders/order-admin` e `orders/order-monitor`: `/orders` é administrativo.

#### Scenario: Usuário comum no /auth/me
- **WHEN** um usuário com `admin = false` chama `GET /auth/me` com seu token
- **THEN** o sistema responde `200` com seus dados e `admin: false`

#### Scenario: Endpoint sem proteção
- **WHEN** um cliente sem token chama `GET /`
- **THEN** o sistema responde como antes desta entrega, sem `401` nem `403`

#### Scenario: Lojas deixam de ser públicas
- **WHEN** um cliente sem token chama `GET /stores`
- **THEN** o sistema responde `401`

#### Scenario: Lojas da vitrine sem token
- **WHEN** um cliente sem token chama `GET /storefront/stores`
- **THEN** o sistema responde `200`, sem `401` nem `403`

#### Scenario: Geocodificação com token comum
- **WHEN** um usuário com `admin = false` chama `GET /geocoding?address=Avenida Paulista` com seu token
- **THEN** o sistema responde `200`, sem `403`

#### Scenario: Geocodificação sem token
- **WHEN** um cliente sem token chama `GET /geocoding?address=Avenida Paulista`
- **THEN** o sistema responde `401`

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
