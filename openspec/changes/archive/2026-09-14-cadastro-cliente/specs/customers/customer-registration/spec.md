## Purpose

Define o cadastro de cliente do Jaja: o vínculo 1:1 com o usuário, os dados necessários para receber pedidos (CPF, telefone e endereço de entrega) e suas validações, o cadastro feito pelo próprio usuário, a consulta e a alteração pela administração e a carga inicial de clientes de desenvolvimento.

## ADDED Requirements

### Requirement: Cliente vinculado a um único usuário
Um cliente SHALL pertencer a exatamente um usuário, e um usuário MUST ter no máximo um cliente. Criar conta ou entrar MUST NOT criar cliente: o cliente só existe depois que o próprio usuário salva os seus dados de cliente. O usuário dono MUST ser definido na criação, a partir do usuário autenticado, e MUST NOT mudar depois, nem por alteração do próprio usuário nem da administração. Nome e email exibidos para um cliente MUST ser os do usuário vinculado. Duas criações simultâneas para o mesmo usuário MUST resultar em um único cliente.

#### Scenario: Conta nova ainda sem cliente
- **WHEN** a visitante "Ana Souza" cria conta e, com o seu token, chama `GET /me/customer`
- **THEN** o sistema responde `404` com `CUSTOMER_NOT_FOUND`

#### Scenario: Um cliente por usuário
- **WHEN** um usuário que já tem cliente envia `PUT /me/customer` com dados válidos
- **THEN** o sistema responde `200` com o mesmo `id` de cliente de antes e não existe um segundo cliente para esse usuário

#### Scenario: Criações simultâneas
- **WHEN** duas requisições `PUT /me/customer` do mesmo usuário sem cliente chegam ao mesmo tempo
- **THEN** existe um único cliente para o usuário, e a requisição que não criou responde `200` com esse cliente ou `409` com `CUSTOMER_ALREADY_EXISTS`

#### Scenario: Vínculo imutável
- **WHEN** um administrador envia `PUT /customers/<id>` com `userId` de outro usuário no corpo
- **THEN** o sistema responde `200` e o cliente continua vinculado ao usuário original

### Requirement: Dados do cliente
Um cliente SHALL ter identificador (uuid), `userId`, `cpf`, `phone`, `address` (`zipCode`, `street`, `number`, `complement`, `neighborhood`, `city`, `state`), `isActive`, `createdAt` e `updatedAt`. As regras são:
- `cpf` é obrigatório e aceita o formato `000.000.000-00` ou apenas dígitos. MUST ter 11 dígitos, MUST NOT ser uma sequência de um só dígito repetido e MUST ter dígitos verificadores válidos. É gravado só com os dígitos.
- `phone` é obrigatório e aceita máscara. MUST ter de 8 a 15 dígitos e é gravado só com os dígitos.
- `zipCode` é obrigatório e aceita `00000-000` ou 8 dígitos. É gravado com os 8 dígitos.
- `street` (2 a 120 caracteres), `number` (1 a 10 caracteres, aceitando "S/N"), `neighborhood` (2 a 60) e `city` (2 a 60) são obrigatórios. Os limites valem após remover espaços nas pontas.
- `complement` é opcional, com até 80 caracteres. Vazio é gravado como ausente (`null`).
- `state` é obrigatório e MUST ser a sigla de uma das 27 unidades federativas do Brasil. Aceita minúsculas e é gravada em maiúsculas.
- `isActive` MUST valer `true` na criação.

Dados inválidos MUST ser rejeitados com `400` e os códigos de erro de validação, cada código uma única vez, sem gravar nada. Os códigos incluem `CPF_INVALID_FORMAT`, `CPF_INVALID_LENGTH`, `CPF_REPEATED_SEQUENCE`, `CPF_INVALID_CHECK_DIGIT`, `PHONE_INVALID_FORMAT`, `PHONE_INVALID_LENGTH`, `CUSTOMER_ZIP_CODE_INVALID`, `CUSTOMER_STATE_INVALID` e os códigos de texto curto ou longo demais.

#### Scenario: Normalização dos dados
- **WHEN** um usuário sem cliente envia `PUT /me/customer` com `cpf: "529.982.247-25"`, `phone: "(85) 99876-5432"` e `address: { zipCode: "60150-160", street: "Av. Santos Dumont", number: "1500", complement: "", neighborhood: "Aldeota", city: "Fortaleza", state: "ce" }`
- **THEN** o sistema responde `200` com `cpf = "52998224725"`, `phone = "85998765432"`, `address.zipCode = "60150160"`, `address.state = "CE"`, `address.complement = null` e `isActive = true`

#### Scenario: CPF inválido
- **WHEN** um usuário envia `PUT /me/customer` com `cpf: "529.982.247-26"` ou com `cpf: "111.111.111-11"`
- **THEN** o sistema responde `400` com `CPF_INVALID_CHECK_DIGIT` ou `CPF_REPEATED_SEQUENCE`, respectivamente, e nada é gravado

#### Scenario: CEP e UF inválidos
- **WHEN** um usuário envia `PUT /me/customer` com `zipCode: "6015-160"` e `state: "XX"`
- **THEN** o sistema responde `400` com `CUSTOMER_ZIP_CODE_INVALID` e `CUSTOMER_STATE_INVALID`, e nada é gravado

#### Scenario: Telefone curto
- **WHEN** um usuário envia `PUT /me/customer` com `phone: "9999"`
- **THEN** o sistema responde `400` com `PHONE_INVALID_LENGTH`

### Requirement: CPF único
O CPF SHALL ser único entre os clientes, comparado depois da normalização para dígitos. Criar ou alterar um cliente com o CPF de outro cliente MUST responder `409` com `CUSTOMER_CPF_ALREADY_EXISTS` e MUST NOT alterar nenhum cliente. Na alteração, o próprio cliente MUST ser ignorado na verificação.

#### Scenario: CPF de outro cliente com máscara diferente
- **WHEN** existe um cliente com CPF `52998224725` e outro usuário envia `PUT /me/customer` com `cpf: "529.982.247-25"`
- **THEN** o sistema responde `409` com `CUSTOMER_CPF_ALREADY_EXISTS` e nenhum cliente é criado

#### Scenario: Reenvio do próprio CPF
- **WHEN** um cliente altera só o telefone, reenviando o seu próprio CPF
- **THEN** o sistema responde `200` com o telefone alterado, sem conflito

### Requirement: Cadastro de cliente pelo próprio usuário
O sistema SHALL expor `GET /me/customer` e `PUT /me/customer` para qualquer usuário autenticado, administrador ou não. Sem token, ou com token expirado ou adulterado, MUST responder `401`.

`GET /me/customer` MUST responder `200` com o cliente do usuário do token: `id`, `userId`, `name` e `email` do usuário, `cpf`, `phone`, `address`, `isActive`, `createdAt` e `updatedAt`. Quando o usuário ainda não tiver cliente, MUST responder `404` com `CUSTOMER_NOT_FOUND`.

`PUT /me/customer` recebe `cpf`, `phone` e `address`:
- sem cliente, MUST criar um cliente com novo `id` uuid, vinculado ao usuário do token;
- com cliente, MUST alterar esse mesmo cliente, substituindo `cpf`, `phone` e o endereço inteiro, e atualizar `updatedAt`.

Em ambos os casos MUST responder `200` com `id`, `userId`, `cpf`, `phone`, `address`, `isActive`, `createdAt` e `updatedAt`. Os campos `id`, `userId` e `isActive` enviados no corpo MUST ser ignorados: o usuário não escolhe o cliente alterado nem ativa ou desativa o próprio cadastro.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /me/customer` ou `PUT /me/customer` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Primeiro cadastro
- **WHEN** um usuário sem cliente envia `PUT /me/customer` com dados válidos e `isActive: false` no corpo
- **THEN** o sistema responde `200` com um cliente novo, `userId` igual ao id do usuário do token e `isActive = true`

#### Scenario: Alteração substitui o endereço
- **WHEN** um cliente com complemento "Torre B" envia `PUT /me/customer` com outro endereço sem `complement`
- **THEN** o sistema responde `200` com o mesmo `id`, o novo endereço e `address.complement = null`

#### Scenario: Consulta do próprio cadastro
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) chama `GET /me/customer`
- **THEN** o sistema responde `200` com os seus dados de cliente, `name = "Ana Souza"` e `email = "ana@exemplo.com"`

#### Scenario: Cliente desativado não se reativa
- **WHEN** um cliente desativado pela administração envia `PUT /me/customer` com `isActive: true` no corpo
- **THEN** o sistema responde `200` e o cliente continua com `isActive = false`

### Requirement: API administrativa de clientes
Todos os endpoints sob `/customers` MUST exigir um JWT válido de usuário com `admin = true`. Sem token válido, MUST responder `401`. Com token de usuário não administrador, MUST responder `403` com `ADMIN_REQUIRED`. A API administrativa SHALL oferecer listagem, busca por identificador e alteração de clientes, e MUST NOT oferecer criação nem exclusão de clientes.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /customers` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Usuário não administrador
- **WHEN** um usuário do seed com `admin = false` chama `GET /customers` com o seu token
- **THEN** o sistema responde `403` com `ADMIN_REQUIRED`

#### Scenario: Sem criação nem exclusão
- **WHEN** um administrador chama `POST /customers` ou `DELETE /customers/<id>`
- **THEN** o sistema não cria nem exclui nenhum cliente e não responde com sucesso

### Requirement: Listar clientes
O sistema SHALL expor `GET /customers` com os parâmetros `page`, `pageSize`, `search` e `isActive`, que responde `200` com `{ items, total, page, pageSize, totalPages }`, onde `totalPages = ceil(total / pageSize)`. Cada item MUST conter `id`, `name` e `email` do usuário, `cpf`, `phone`, `neighborhood`, `city`, `state` e `isActive`.

Paginação e filtros:
- `page` MUST valer 1 por padrão.
- `pageSize` MUST valer 20 por padrão e no máximo 100. Valores inválidos voltam ao padrão.
- `isActive` MUST ser aplicado só quando for `true` ou `false`.

Ordenação e busca:
- Sem `search`, a lista MUST ser ordenada pelo nome do usuário, sem distinção de maiúsculas e acentos.
- Com `search`, cada termo MUST casar o início de uma palavra no nome ou no email do usuário, no CPF, no telefone ou no bairro, com os melhores resultados primeiro.
- Termos formados só por dígitos, pontos, traços, parênteses e espaços MUST ser comparados apenas pelos dígitos, para CPF e telefone digitados com máscara serem encontrados.

#### Scenario: Primeira página após o seed
- **WHEN** após o seed um administrador chama `GET /customers`
- **THEN** o sistema responde `200` com `total = 40`, `page = 1`, `pageSize = 20`, `totalPages = 2` e 20 itens ordenados pelo nome do usuário

#### Scenario: Busca por CPF com máscara
- **WHEN** existe o cliente de CPF `52998224725` e um administrador chama `GET /customers?search=529.982`
- **THEN** a lista contém esse cliente

#### Scenario: Busca pelo início do nome
- **WHEN** um administrador chama `GET /customers?search=ana` após o seed
- **THEN** a lista contém apenas clientes com uma palavra iniciada por "ana" no nome, no email ou no bairro, e `total` corresponde a essa quantidade

#### Scenario: Tamanho de página limitado
- **WHEN** um administrador chama `GET /customers?pageSize=500`
- **THEN** o sistema responde com `pageSize = 100`

#### Scenario: Filtro por status
- **WHEN** existe um cliente inativo e um administrador chama `GET /customers?isActive=false`
- **THEN** a lista contém apenas clientes com `isActive = false`

### Requirement: Buscar cliente por identificador
O sistema SHALL expor `GET /customers/:id`, que responde `200` com o cliente: os mesmos campos de `GET /me/customer`, incluindo `name` e `email` do usuário. Quando nenhum cliente tiver o identificador informado, inclusive quando ele não for um uuid, MUST responder `404` com `CUSTOMER_NOT_FOUND`.

#### Scenario: Cliente existente
- **WHEN** um administrador chama `GET /customers/<id>` com o id de um cliente do seed
- **THEN** o sistema responde `200` com os dados do cliente, `name` e `email` do usuário vinculado

#### Scenario: Cliente inexistente
- **WHEN** um administrador chama `GET /customers/<id>` com um uuid que não pertence a nenhum cliente, ou com `GET /customers/new`
- **THEN** o sistema responde `404` com `CUSTOMER_NOT_FOUND`

### Requirement: Alterar cliente pela administração
O sistema SHALL expor `PUT /customers/:id`, que recebe `cpf`, `phone`, `address` e, opcionalmente, `isActive`. Quando o cliente existir, MUST aplicar as mesmas validações e a mesma regra de CPF único, substituir o endereço inteiro, aplicar `isActive` quando enviado (e manter o atual quando omitido), atualizar `updatedAt` e responder `200` com o cliente alterado. O `id` da rota MUST prevalecer sobre um `id` no corpo. `userId` no corpo MUST ser ignorado. Quando nenhum cliente tiver o `id` da rota, MUST responder `404` com `CUSTOMER_NOT_FOUND`, sem criar cliente.

#### Scenario: Desativar cliente
- **WHEN** um administrador envia `PUT /customers/<id>` com os dados atuais do cliente e `isActive: false`
- **THEN** o sistema responde `200` com `isActive = false`, e o cliente passa a aparecer em `GET /customers?isActive=false`

#### Scenario: Cliente inexistente não é criado
- **WHEN** um administrador envia `PUT /customers/<id>` com dados válidos e um uuid que não pertence a nenhum cliente
- **THEN** o sistema responde `404` com `CUSTOMER_NOT_FOUND` e nenhum cliente é criado

#### Scenario: CPF de outro cliente
- **WHEN** um administrador altera um cliente usando o CPF de outro cliente
- **THEN** o sistema responde `409` com `CUSTOMER_CPF_ALREADY_EXISTS` e nenhum dos dois clientes muda

### Requirement: Carga inicial de clientes de desenvolvimento
O seed de desenvolvimento SHALL cadastrar 40 clientes fictícios, um para cada um dos 40 primeiros usuários não administradores do seed de usuários, na ordem desse seed. Cada cliente tem:
- CPF fictício válido e único;
- telefone celular de Fortaleza;
- endereço em Fortaleza/CE, em bairros da vitrine.

Os usuários administradores MUST NOT receber cliente, e os demais usuários comuns MUST ficar sem cliente. Executar o seed novamente MUST NOT duplicar clientes nem sobrescrever clientes existentes, inclusive os alterados pelo próprio cliente ou pela administração. Um item cujo usuário não existir MUST ser ignorado com um aviso, sem interromper o seed. Se o arquivo de dados não existir, o seed MUST falhar com uma mensagem que indique o caminho esperado.

#### Scenario: Seed em banco sem clientes
- **WHEN** o seed é executado depois do seed de usuários em um banco sem clientes
- **THEN** existem 40 clientes, todos de usuários com `admin = false`, com CPFs únicos, e `usuario@formacao.dev` e `admin@jaja.dev` não têm cliente

#### Scenario: Seed repetido preserva alterações
- **WHEN** um administrador desativa um cliente do seed e o seed é executado de novo
- **THEN** continuam existindo 40 clientes e aquele cliente continua com `isActive = false`
