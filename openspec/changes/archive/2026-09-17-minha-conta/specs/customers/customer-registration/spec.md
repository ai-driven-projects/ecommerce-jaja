## MODIFIED Requirements

### Requirement: Dados do cliente
Um cliente SHALL ter identificador (uuid), `userId`, `cpf`, `phone`, `address` (`zipCode`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `location`), `isActive`, `createdAt` e `updatedAt`. As regras são:
- `cpf` é obrigatório e aceita o formato `000.000.000-00` ou apenas dígitos. MUST ter 11 dígitos, MUST NOT ser uma sequência de um só dígito repetido e MUST ter dígitos verificadores válidos. É gravado só com os dígitos.
- `phone` é obrigatório e aceita máscara. MUST ter de 8 a 15 dígitos e é gravado só com os dígitos.
- `zipCode` é obrigatório e aceita `00000-000` ou 8 dígitos. É gravado com os 8 dígitos.
- `street` (2 a 120 caracteres), `number` (1 a 10 caracteres, aceitando "S/N"), `neighborhood` (2 a 60) e `city` (2 a 60) são obrigatórios. Os limites valem após remover espaços nas pontas.
- `complement` é opcional, com até 80 caracteres. Vazio é gravado como ausente (`null`).
- `state` é obrigatório e MUST ser a sigla de uma das 27 unidades federativas do Brasil. Aceita minúsculas e é gravada em maiúsculas.
- `location` é o ponto do endereço no mapa, opcional: `{ latitude, longitude }` em graus decimais, ou `null` quando o cliente não marcou ponto. O texto do endereço é para o entregador; o ponto é o que as regras de cobertura por loja vão usar. Quando presente, MUST ter as duas coordenadas, números finitos, com `latitude` de −90 a 90 e `longitude` de −180 a 180 (limites incluídos). As duas coordenadas MUST ser arredondadas para 6 casas decimais, e −0 é gravado como 0. Um cliente MUST NOT ter só uma das coordenadas gravada.
- `isActive` MUST valer `true` na criação.

Dados inválidos MUST ser rejeitados com `400` e os códigos de erro de validação, cada código uma única vez, sem gravar nada. Os códigos incluem `CPF_INVALID_FORMAT`, `CPF_INVALID_LENGTH`, `CPF_REPEATED_SEQUENCE`, `CPF_INVALID_CHECK_DIGIT`, `PHONE_INVALID_FORMAT`, `PHONE_INVALID_LENGTH`, `CUSTOMER_ZIP_CODE_INVALID`, `CUSTOMER_STATE_INVALID`, `CUSTOMER_LOCATION_INVALID` e os códigos de texto curto ou longo demais.

#### Scenario: Normalização dos dados
- **WHEN** um usuário sem cliente envia `PUT /me/customer` com `cpf: "529.982.247-25"`, `phone: "(85) 99876-5432"` e `address: { zipCode: "60150-160", street: "Av. Santos Dumont", number: "1500", complement: "", neighborhood: "Aldeota", city: "Fortaleza", state: "ce" }`
- **THEN** o sistema responde `200` com `cpf = "52998224725"`, `phone = "85998765432"`, `address.zipCode = "60150160"`, `address.state = "CE"`, `address.complement = null`, `address.location = null` e `isActive = true`

#### Scenario: CPF inválido
- **WHEN** um usuário envia `PUT /me/customer` com `cpf: "529.982.247-26"` ou com `cpf: "111.111.111-11"`
- **THEN** o sistema responde `400` com `CPF_INVALID_CHECK_DIGIT` ou `CPF_REPEATED_SEQUENCE`, respectivamente, e nada é gravado

#### Scenario: CEP e UF inválidos
- **WHEN** um usuário envia `PUT /me/customer` com `zipCode: "6015-160"` e `state: "XX"`
- **THEN** o sistema responde `400` com `CUSTOMER_ZIP_CODE_INVALID` e `CUSTOMER_STATE_INVALID`, e nada é gravado

#### Scenario: Telefone curto
- **WHEN** um usuário envia `PUT /me/customer` com `phone: "9999"`
- **THEN** o sistema responde `400` com `PHONE_INVALID_LENGTH`

#### Scenario: Ponto arredondado
- **WHEN** um usuário envia `PUT /me/customer` com dados válidos e `address.location: { latitude: -23.5614141234, longitude: -46.6558809876 }`
- **THEN** o sistema responde `200` com `address.location = { latitude: -23.561414, longitude: -46.655881 }`

#### Scenario: Coordenadas nos limites
- **WHEN** um usuário envia `PUT /me/customer` com dados válidos e `address.location: { latitude: -90, longitude: 180 }`
- **THEN** o sistema responde `200` com `address.location = { latitude: -90, longitude: 180 }`

#### Scenario: Ponto inválido
- **WHEN** um usuário envia `PUT /me/customer` com `address.location: { latitude: 91, longitude: -46.65 }`, com `address.location: { latitude: -23.56 }` ou com uma coordenada em texto
- **THEN** o sistema responde `400` com `CUSTOMER_LOCATION_INVALID` e nada é gravado

### Requirement: Cadastro de cliente pelo próprio usuário
O sistema SHALL expor `GET /me/customer` e `PUT /me/customer` para qualquer usuário autenticado, administrador ou não. Sem token, ou com token expirado ou adulterado, MUST responder `401`.

`GET /me/customer` MUST responder `200` com o cliente do usuário do token: `id`, `userId`, `name` e `email` do usuário, `cpf`, `phone`, `address` (incluindo `location`, `null` quando não houver ponto), `isActive`, `createdAt` e `updatedAt`. Quando o usuário ainda não tiver cliente, MUST responder `404` com `CUSTOMER_NOT_FOUND`.

`PUT /me/customer` recebe `cpf`, `phone` e `address`:
- sem cliente, MUST criar um cliente com novo `id` uuid, vinculado ao usuário do token. `address.location` ausente ou `null` MUST criar o cliente sem ponto;
- com cliente, MUST alterar esse mesmo cliente, substituindo `cpf`, `phone` e os campos de texto do endereço, e atualizar `updatedAt`.

Na alteração, o ponto do endereço SHALL seguir a regra de preservação, para que telas sem mapa não apaguem o ponto marcado:
- `address.location` ausente MUST manter o ponto atual do cliente, mesmo que os campos de texto do endereço mudem;
- `address.location: null` MUST remover o ponto;
- `address.location` com coordenadas válidas MUST substituir o ponto.

Em ambos os casos MUST responder `200` com `id`, `userId`, `cpf`, `phone`, `address`, `isActive`, `createdAt` e `updatedAt`. Os campos `id`, `userId` e `isActive` enviados no corpo MUST ser ignorados: o usuário não escolhe o cliente alterado nem ativa ou desativa o próprio cadastro.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /me/customer` ou `PUT /me/customer` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Primeiro cadastro
- **WHEN** um usuário sem cliente envia `PUT /me/customer` com dados válidos e `isActive: false` no corpo
- **THEN** o sistema responde `200` com um cliente novo, `userId` igual ao id do usuário do token e `isActive = true`

#### Scenario: Primeiro cadastro com ponto
- **WHEN** um usuário sem cliente envia `PUT /me/customer` com dados válidos e `address.location: { latitude: -23.561414, longitude: -46.655881 }`
- **THEN** o sistema responde `200` com um cliente novo e esse `address.location`, e `GET /me/customer` devolve o mesmo ponto

#### Scenario: Alteração substitui o endereço
- **WHEN** um cliente com complemento "Torre B" envia `PUT /me/customer` com outro endereço sem `complement`
- **THEN** o sistema responde `200` com o mesmo `id`, o novo endereço e `address.complement = null`

#### Scenario: Alteração sem ponto mantém o ponto atual
- **WHEN** um cliente com ponto `{ latitude: -23.561414, longitude: -46.655881 }` envia `PUT /me/customer` com outro número no endereço e sem `address.location`
- **THEN** o sistema responde `200` com o novo número e `address.location = { latitude: -23.561414, longitude: -46.655881 }`

#### Scenario: Remover o ponto
- **WHEN** um cliente com ponto envia `PUT /me/customer` com dados válidos e `address.location: null`
- **THEN** o sistema responde `200` com `address.location = null`

#### Scenario: Substituir o ponto
- **WHEN** um cliente com ponto envia `PUT /me/customer` com dados válidos e `address.location: { latitude: -22.906847, longitude: -43.172897 }`
- **THEN** o sistema responde `200` com `address.location = { latitude: -22.906847, longitude: -43.172897 }`

#### Scenario: Ponto inválido não altera o cliente
- **WHEN** um cliente com ponto envia `PUT /me/customer` com outro telefone e `address.location: { latitude: 91, longitude: -46.65 }`
- **THEN** o sistema responde `400` com `CUSTOMER_LOCATION_INVALID`, e o telefone e o ponto do cliente continuam os de antes

#### Scenario: Consulta do próprio cadastro
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) chama `GET /me/customer`
- **THEN** o sistema responde `200` com os seus dados de cliente, `name = "Ana Souza"` e `email = "ana@exemplo.com"`

#### Scenario: Cliente desativado não se reativa
- **WHEN** um cliente desativado pela administração envia `PUT /me/customer` com `isActive: true` no corpo
- **THEN** o sistema responde `200` e o cliente continua com `isActive = false`

### Requirement: Alterar cliente pela administração
O sistema SHALL expor `PUT /customers/:id`, que recebe `cpf`, `phone`, `address` e, opcionalmente, `isActive`. Quando o cliente existir, MUST aplicar as mesmas validações e a mesma regra de CPF único, substituir os campos de texto do endereço, aplicar ao ponto do endereço a mesma regra de preservação de `PUT /me/customer` (ausente mantém, `null` remove, coordenadas substituem), aplicar `isActive` quando enviado (e manter o atual quando omitido), atualizar `updatedAt` e responder `200` com o cliente alterado. O `id` da rota MUST prevalecer sobre um `id` no corpo. `userId` no corpo MUST ser ignorado. Quando nenhum cliente tiver o `id` da rota, MUST responder `404` com `CUSTOMER_NOT_FOUND`, sem criar cliente.

#### Scenario: Desativar cliente
- **WHEN** um administrador envia `PUT /customers/<id>` com os dados atuais do cliente e `isActive: false`
- **THEN** o sistema responde `200` com `isActive = false`, e o cliente passa a aparecer em `GET /customers?isActive=false`

#### Scenario: Cliente inexistente não é criado
- **WHEN** um administrador envia `PUT /customers/<id>` com dados válidos e um uuid que não pertence a nenhum cliente
- **THEN** o sistema responde `404` com `CUSTOMER_NOT_FOUND` e nenhum cliente é criado

#### Scenario: CPF de outro cliente
- **WHEN** um administrador altera um cliente usando o CPF de outro cliente
- **THEN** o sistema responde `409` com `CUSTOMER_CPF_ALREADY_EXISTS` e nenhum dos dois clientes muda

#### Scenario: Alteração administrativa preserva o ponto
- **WHEN** um cliente marcou o ponto `{ latitude: -23.561414, longitude: -46.655881 }` e um administrador envia `PUT /customers/<id>` com outro bairro e sem `address.location`
- **THEN** o sistema responde `200` com o novo bairro e `address.location = { latitude: -23.561414, longitude: -46.655881 }`
