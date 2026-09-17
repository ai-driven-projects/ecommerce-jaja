# Cadastro de Lojas (Store Registration) Specification

## Purpose

Define o cadastro de lojas do Jaja pela API. As lojas são os pontos de onde saem as entregas rápidas. A spec cobre os dados da loja com ponto no mapa e raio de atendimento, as validações, a unicidade de nome e slug, a exclusão lógica, o contrato HTTP `/stores` restrito a administradores e a carga inicial das lojas de desenvolvimento.

## Requirements

### Requirement: Dados da loja
Uma loja SHALL ter identificador (uuid), `name`, `slug`, `phone`, `address`, `latitude`, `longitude`, `deliveryRadiusMeters`, `isActive`, `createdAt` e `updatedAt`:
- `name` MUST ter de 2 a 100 caracteres após remover espaços nas pontas;
- `slug` MUST seguir o padrão `^[a-z0-9]+(?:-[a-z0-9]+)*$`;
- `phone` é opcional; quando informado, MUST ter de 8 a 15 dígitos, aceitando `+`, espaços, pontos, hífens, barras e parênteses, e MUST ser gravado só com os dígitos;
- `address` é o endereço de referência da loja, opcional e em texto livre; quando informado, MUST ter no máximo 200 caracteres após remover espaços nas pontas, e vazio MUST virar `null`;
- `latitude` e `longitude` são obrigatórias; `latitude` MUST estar entre −90 e 90 e `longitude` entre −180 e 180, e as duas MUST ser gravadas arredondadas para 6 casas decimais;
- `deliveryRadiusMeters` MUST ser um inteiro de 300 a 10.000 e MUST valer 1.000 quando não informado na criação;
- `isActive` MUST valer `true` quando não informado na criação.

Dados inválidos MUST ser rejeitados com `400` e os códigos de erro de validação, cada código uma única vez, sem gravar nada. Os códigos incluem `GEO_POINT_LATITUDE_INVALID`, `GEO_POINT_LONGITUDE_INVALID`, `DELIVERY_RADIUS_INVALID`, `PHONE_INVALID_FORMAT` e `PHONE_INVALID_LENGTH`.

#### Scenario: Loja válida com valores padrão
- **WHEN** um administrador cria a loja `{ name: "Loja Meireles", latitude: -3.7247, longitude: -38.4968 }`
- **THEN** a loja é gravada com `slug = "loja-meireles"`, `phone = null`, `address = null`, `deliveryRadiusMeters = 1000` e `isActive = true`

#### Scenario: Telefone gravado só com dígitos
- **WHEN** um administrador cria uma loja com `phone: "(85) 3000-1001"`
- **THEN** a loja é gravada com `phone = "8530001001"`

#### Scenario: Coordenadas arredondadas
- **WHEN** um administrador cria uma loja com `latitude: -3.73561234` e `longitude: -38.50129876`
- **THEN** a loja é gravada com `latitude = -3.735612` e `longitude = -38.501299`

#### Scenario: Coordenadas fora do intervalo
- **WHEN** um administrador tenta criar uma loja com `latitude: 91` e `longitude: -181`
- **THEN** o sistema responde `400` com `GEO_POINT_LATITUDE_INVALID` e `GEO_POINT_LONGITUDE_INVALID` e nenhuma loja é criada

#### Scenario: Coordenadas ausentes
- **WHEN** um administrador tenta criar a loja `{ name: "Loja Meireles" }`, sem `latitude` nem `longitude`
- **THEN** o sistema responde `400` com `GEO_POINT_LATITUDE_INVALID` e `GEO_POINT_LONGITUDE_INVALID` e nenhuma loja é criada

#### Scenario: Raio fora do intervalo
- **WHEN** um administrador tenta criar uma loja com `deliveryRadiusMeters` igual a `299`, `10001` ou `1500.5`
- **THEN** o sistema responde `400` com `DELIVERY_RADIUS_INVALID` e nenhuma loja é criada

#### Scenario: Telefone inválido
- **WHEN** um administrador tenta criar uma loja com `phone: "9999"`
- **THEN** o sistema responde `400` com `PHONE_INVALID_LENGTH` e nenhuma loja é criada

#### Scenario: Endereço de referência longo demais
- **WHEN** um administrador tenta criar uma loja com `address` de 201 caracteres
- **THEN** o sistema responde `400` com o código de texto longo demais e nenhuma loja é criada

### Requirement: Slug derivado do nome
Quando o `slug` não for informado na criação, o sistema SHALL derivá-lo do `name`: letras minúsculas, sem acentos, cada sequência de caracteres que não sejam letras ou dígitos substituída por um hífen, sem hífens nas pontas. Na alteração, um `slug` não informado MUST manter o slug atual da loja.

#### Scenario: Nome com acento
- **WHEN** um administrador cria a loja `{ name: "Loja Cocó", latitude: -3.7475, longitude: -38.4839 }` sem `slug`
- **THEN** a loja é gravada com `slug = "loja-coco"`

#### Scenario: Alteração sem slug
- **WHEN** um administrador altera o nome da loja de slug `loja-coco` para "Loja Cocó Sul" sem enviar `slug`
- **THEN** a loja passa a se chamar "Loja Cocó Sul" e continua com `slug = "loja-coco"`

### Requirement: Nome e slug únicos
O `name` SHALL ser único entre as lojas sem distinção de maiúsculas e minúsculas, e o `slug` SHALL ser único entre as lojas. Criar ou alterar uma loja com um nome já usado por outra loja MUST responder `409` com `STORE_NAME_ALREADY_EXISTS`; com um slug já usado por outra loja MUST responder `409` com `STORE_SLUG_ALREADY_EXISTS`. Na alteração, a própria loja MUST ser ignorada na verificação. Nome e slug de uma loja excluída MUST continuar reservados e produzir os mesmos `409`.

#### Scenario: Nome duplicado com outra caixa
- **WHEN** existe a loja "Loja Aldeota" e um administrador cria a loja `{ name: "LOJA ALDEOTA", slug: "loja-aldeota-2", latitude: -3.7356, longitude: -38.5012 }`
- **THEN** o sistema responde `409` com `STORE_NAME_ALREADY_EXISTS` e nenhuma loja é criada

#### Scenario: Slug duplicado
- **WHEN** existe a loja de slug `loja-aldeota` e um administrador cria a loja `{ name: "Loja Aldeota Norte", slug: "loja-aldeota", latitude: -3.7300, longitude: -38.5000 }`
- **THEN** o sistema responde `409` com `STORE_SLUG_ALREADY_EXISTS`

#### Scenario: Alteração mantendo o próprio nome
- **WHEN** um administrador altera apenas o raio da loja "Loja Aldeota", reenviando `name: "Loja Aldeota"` e `slug: "loja-aldeota"`
- **THEN** o sistema responde `200` com o raio alterado, sem conflito

#### Scenario: Nome de loja excluída
- **WHEN** a loja "Loja Aldeota" (slug `loja-aldeota`) foi excluída e um administrador cria a loja `{ name: "Loja Aldeota", latitude: -3.7356, longitude: -38.5012 }`
- **THEN** o sistema responde `409` com o código de conflito correspondente e nenhuma loja é criada

### Requirement: Raio de atendimento informativo
O ponto e o raio SHALL descrever a área que a loja pretende atender, medida em linha reta a partir do ponto, sem restringir nenhuma operação nesta versão. Raios de lojas diferentes MUST poder se sobrepor. A loja MUST NOT ser rejeitada por causa da distância entre o ponto e o endereço de referência.

#### Scenario: Raios sobrepostos
- **WHEN** existe a loja "Loja Aldeota" com raio de 2.500 m e um administrador cria "Loja Meireles" com o ponto a cerca de 1 km dela e raio de 2.000 m
- **THEN** o sistema responde `201` e as duas lojas passam a existir

#### Scenario: Ponto distante do endereço de referência
- **WHEN** um administrador cria uma loja com `address: "Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE"` e o ponto `latitude: -23.561414`, `longitude: -46.655881`, na Avenida Paulista
- **THEN** o sistema responde `201` com o endereço e o ponto informados

### Requirement: API de lojas restrita a administradores
Todos os endpoints sob `/stores` MUST exigir um JWT válido de um usuário com `admin = true`. Sem token, com token expirado ou adulterado o sistema MUST responder `401`; com token válido de usuário não administrador MUST responder `403`. Nenhum desses casos MUST ler ou alterar lojas.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /stores` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Usuário não administrador
- **WHEN** um usuário do seed com `admin = false` chama `POST /stores` com o seu token
- **THEN** o sistema responde `403` e nenhuma loja é criada

### Requirement: Criar loja
O sistema SHALL expor `POST /stores` recebendo `name`, `latitude`, `longitude` e, opcionalmente, `slug`, `phone`, `address`, `deliveryRadiusMeters` e `isActive`. Em sucesso MUST responder `201` com a loja criada (`id`, `name`, `slug`, `phone`, `address`, `latitude`, `longitude`, `deliveryRadiusMeters`, `isActive`, `createdAt`, `updatedAt`), com um `id` uuid gerado pelo sistema. Um `id` enviado no corpo MUST ser ignorado.

#### Scenario: Criação válida
- **WHEN** um administrador envia `POST /stores` com `{ name: "Loja Meireles", phone: "(85) 3000-1003", address: "Avenida Beira Mar, 3000 – Meireles, Fortaleza/CE", latitude: -3.7247, longitude: -38.4968, deliveryRadiusMeters: 2000 }`
- **THEN** o sistema responde `201` com a loja de `slug = "loja-meireles"`, `phone = "8530001003"`, `deliveryRadiusMeters = 2000`, `isActive = true` e um `id` uuid

#### Scenario: Id no corpo ignorado
- **WHEN** um administrador envia `POST /stores` com um `id` uuid no corpo e dados válidos
- **THEN** o sistema responde `201` com um `id` diferente do enviado

### Requirement: Listar lojas
O sistema SHALL expor `GET /stores`, que devolve `200` com uma página de lojas não excluídas no formato `{ items, total, page, pageSize, totalPages }`:
- `page` (padrão 1) e `pageSize` (padrão 20, máximo 100) MUST aceitar só inteiros positivos; valores inválidos MUST usar o padrão, e `pageSize` acima do máximo MUST ser limitado a 100;
- uma página além da última MUST devolver `items` vazio, com `total` e `totalPages` corretos;
- sem busca, as lojas MUST vir ordenadas por nome, sem distinção de maiúsculas, minúsculas e acentos;
- o parâmetro `search`, quando informado, MUST funcionar como busca textual: o texto é separado em termos, acentos e caixa são ignorados, e cada termo MUST casar com o início de uma palavra do nome, do slug ou do endereço de referência; as lojas que casam no nome ou no slug vêm antes das que casam só no endereço;
- um texto de busca sem letras nem dígitos MUST ser tratado como ausência de busca;
- o parâmetro `isActive`, quando `true` ou `false`, MUST filtrar pelo status.

#### Scenario: Lista após o seed
- **WHEN** após o seed um administrador chama `GET /stores`
- **THEN** o sistema responde `200` com `total: 2`, `page: 1`, `pageSize: 20`, `totalPages: 1` e "Loja Paulista" antes de "Loja Rio Branco"

#### Scenario: Busca pelo endereço de referência
- **WHEN** após o seed um administrador chama `GET /stores?search=conjunto nacional`
- **THEN** o sistema responde `200` apenas com a loja "Loja Paulista"

#### Scenario: pageSize acima do máximo
- **WHEN** um administrador chama `GET /stores?pageSize=500`
- **THEN** a resposta traz `pageSize: 100`

#### Scenario: Filtro por status
- **WHEN** existe uma loja inativa e um administrador chama `GET /stores?isActive=false`
- **THEN** a lista contém apenas lojas com `isActive = false`

#### Scenario: Loja excluída não aparece
- **WHEN** um administrador exclui a loja "Loja Cocó" e chama `GET /stores?search=coco`
- **THEN** "Loja Cocó" não aparece na lista

### Requirement: Buscar loja por identificador
O sistema SHALL expor `GET /stores/:id`, que responde `200` com a loja quando ela existir e não estiver excluída. Caso contrário, inclusive quando o identificador não for um uuid, MUST responder `404` com `STORE_NOT_FOUND`.

#### Scenario: Loja existente
- **WHEN** um administrador chama `GET /stores/<id>` com o id de uma loja ativa
- **THEN** o sistema responde `200` com os dados da loja, incluindo `latitude`, `longitude` e `deliveryRadiusMeters`

#### Scenario: Loja inexistente
- **WHEN** um administrador chama `GET /stores/<id>` com um uuid que não pertence a nenhuma loja, ou com `abc`
- **THEN** o sistema responde `404` com `STORE_NOT_FOUND`

### Requirement: Alterar loja
O sistema SHALL expor `PUT /stores/:id` recebendo os mesmos campos da criação. Quando a loja existir, o sistema MUST:
- aplicar as mesmas validações e regras de unicidade;
- manter o valor atual dos campos omitidos;
- limpar `phone` e `address` quando enviados como `null` ou vazios;
- responder `200` com a loja alterada e `updatedAt` atualizado.

O `id` da rota MUST prevalecer sobre um `id` no corpo. Quando o `id` informado nunca pertenceu a uma loja, MUST criar a loja com esse `id`. Quando o `id` pertencer a uma loja excluída, MUST responder `404` com `STORE_NOT_FOUND`.

#### Scenario: Mover o ponto e mudar o raio
- **WHEN** um administrador envia `PUT /stores/<id>` da loja "Loja Aldeota" com `{ name: "Loja Aldeota", latitude: -3.7300, longitude: -38.4950, deliveryRadiusMeters: 3000 }`
- **THEN** o sistema responde `200` com o novo ponto, `deliveryRadiusMeters = 3000` e o `slug` inalterado

#### Scenario: Limpar telefone e endereço
- **WHEN** um administrador envia `PUT /stores/<id>` de uma loja com telefone e endereço, com `phone: null` e `address: ""`
- **THEN** o sistema responde `200` com `phone = null` e `address = null`

#### Scenario: Alteração de loja excluída
- **WHEN** um administrador envia `PUT /stores/<id>` com o id de uma loja excluída
- **THEN** o sistema responde `404` com `STORE_NOT_FOUND` e a loja continua excluída

### Requirement: Exclusão lógica de loja
O sistema SHALL expor `DELETE /stores/:id`, que marca a loja como excluída, preservando o registro, e responde `204` sem corpo. Depois disso, a loja MUST NOT ser retornada por nenhuma busca ou listagem. Excluir uma loja inexistente ou já excluída MUST responder `404` com `STORE_NOT_FOUND`.

#### Scenario: Exclusão seguida de busca
- **WHEN** um administrador chama `DELETE /stores/<id>` e em seguida `GET /stores/<id>`
- **THEN** a exclusão responde `204`, a busca responde `404` e o registro continua no banco com a data de exclusão preenchida

#### Scenario: Exclusão de loja inexistente
- **WHEN** um administrador chama `DELETE /stores/<id>` com um uuid que não pertence a nenhuma loja
- **THEN** o sistema responde `404` com `STORE_NOT_FOUND`

### Requirement: Carga inicial das lojas
O seed de desenvolvimento SHALL cadastrar as lojas de `apps/backend/prisma/seed/data/stores.json`, arquivo versionado e escrito à mão, já no formato do banco. O arquivo contém "Loja Paulista" (`loja-paulista`), na Avenida Paulista em São Paulo/SP, e "Loja Rio Branco" (`loja-rio-branco`), na Avenida Rio Branco, no Centro do Rio de Janeiro/RJ, ambas com raio de 2.500 m e ativas. Executar o seed novamente MUST NOT duplicar lojas, sobrescrever lojas já existentes nem recriar lojas excluídas. Se o arquivo não existir, o seed MUST falhar com uma mensagem que indique o caminho esperado.

#### Scenario: Seed em banco vazio
- **WHEN** o seed é executado em um banco sem lojas
- **THEN** a tabela de lojas passa a ter 2 registros, "Loja Paulista" e "Loja Rio Branco", com raio de 2.500 m e `isActive = true`; a "Loja Paulista" com latitude entre −23,6 e −23,5 e longitude entre −46,7 e −46,6, e a "Loja Rio Branco" com latitude entre −23,0 e −22,8 e longitude entre −43,3 e −43,1

#### Scenario: Seed repetido
- **WHEN** o seed é executado duas vezes seguidas
- **THEN** a tabela de lojas continua com 2 registros

#### Scenario: Edição preservada pelo seed
- **WHEN** um administrador altera o raio da "Loja Paulista" para 3.000 m e o seed é executado de novo
- **THEN** a "Loja Paulista" continua com raio de 3.000 m
