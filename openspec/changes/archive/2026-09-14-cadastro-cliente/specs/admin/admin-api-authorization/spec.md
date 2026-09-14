## MODIFIED Requirements

### Requirement: Endpoints não administrativos não mudam
A introdução da proteção administrativa MUST NOT alterar o acesso aos endpoints que não a declaram:
- `POST /auth/register` e `POST /auth/login` continuam públicos;
- `GET /auth/me` continua exigindo apenas token válido, de qualquer usuário;
- `GET /`, `/orders` e `/stores` continuam acessíveis sem token.

Os endpoints de clientes seguem `customers/customer-registration`: `/customers` é administrativo, e `/me/customer` exige apenas token válido, de qualquer usuário.

#### Scenario: Usuário comum no /auth/me
- **WHEN** um usuário com `admin = false` chama `GET /auth/me` com seu token
- **THEN** o sistema responde `200` com seus dados e `admin: false`

#### Scenario: Endpoint sem proteção
- **WHEN** um cliente sem token chama `GET /`
- **THEN** o sistema responde como antes desta entrega, sem `401` nem `403`

#### Scenario: Clientes deixam de ser públicos
- **WHEN** um cliente sem token chama `GET /customers`
- **THEN** o sistema responde `401`

#### Scenario: Cadastro do próprio cliente com token comum
- **WHEN** um usuário com `admin = false` chama `GET /me/customer` com seu token
- **THEN** o sistema não responde `401` nem `403`
