## MODIFIED Requirements

### Requirement: Endpoints não administrativos não mudam
A introdução da proteção administrativa MUST NOT alterar o acesso aos endpoints que não a declaram:
- `POST /auth/register` e `POST /auth/login` continuam públicos;
- `GET /auth/me` continua exigindo apenas token válido, de qualquer usuário;
- `GET /`, `/orders` e `/customers` continuam acessíveis sem token.

Os endpoints de lojas seguem `stores/store-registration` e `stores/address-geocoding`: `/stores` e `/geocoding` são administrativos.

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
