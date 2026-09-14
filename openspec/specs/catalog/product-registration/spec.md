# Cadastro de Produtos (Product Registration) Specification

## Purpose

Define o cadastro de produtos do catálogo do Jaja: atributos e validações, unicidade de slug e sku, vínculo com marca e categoria, preços em centavos, imagens ordenadas, listagem paginada com filtros, alteração, exclusão lógica, acesso restrito a administradores e a carga inicial a partir dos dados raspados da Kalunga.

## Requirements

### Requirement: Endpoints de produto restritos a administradores
Todos os endpoints sob `/products` (`POST /products`, `GET /products`, `GET /products/:id`, `PUT /products/:id` e `DELETE /products/:id`) SHALL exigir um JWT de administrador. Sem token o sistema MUST responder `401`; com token de usuário não administrador MUST responder `403`, sem ler nem alterar dados.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /products` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Usuário comum
- **WHEN** um usuário com `admin = false` chama `POST /products` com um corpo válido
- **THEN** o sistema responde `403` e nenhum produto é criado

### Requirement: Criação de produto
O sistema SHALL criar um produto por `POST /products` a partir de `name`, `categoryId`, `priceCents` e, opcionalmente, `slug`, `sku`, `brandId`, `description`, `listPriceCents`, `unit`, `images`, `isActive` e `isFeatured`.

Em sucesso MUST responder `201` com o produto completo:
- `id` (uuid v4 gerado pelo sistema), `name`, `slug` e `sku`;
- `brandId`, `categoryId` e `description`;
- `priceCents`, `listPriceCents` e `unit`;
- `images` (`thumbUrl`, `largeUrl`, `order`);
- `isActive` e `isFeatured`;
- `brandName` (nome da marca ou `null`);
- `categoryPath` (nomes da categoria e de seus ancestrais separados por ` / `);
- `createdAt` e `updatedAt`.

Valores padrão:
- `isActive` omitido MUST ser `true`;
- `isFeatured` omitido MUST ser `false`;
- `unit` omitido MUST ser `"unidade"`;
- `images` omitido MUST ser uma lista vazia;
- demais campos opcionais ausentes MUST ser `null`.

#### Scenario: Criação com marca e categoria
- **WHEN** um administrador envia `{ name: "Caneta Esferográfica Azul", brandId: <marca BIC>, categoryId: <categoria "Escrita & Corretivos / Canetas">, priceCents: 390 }`
- **THEN** o sistema responde `201` com `slug: "caneta-esferografica-azul"`, `brandName: "BIC"`, `categoryPath: "Escrita & Corretivos / Canetas"`, `isActive: true`, `isFeatured: false`, `unit: "unidade"` e `images: []`

#### Scenario: Criação sem marca
- **WHEN** um administrador envia um produto válido sem `brandId`
- **THEN** o sistema responde `201` com `brandId: null` e `brandName: null`

#### Scenario: Criação em destaque
- **WHEN** um administrador envia um produto válido com `isFeatured: true`
- **THEN** o sistema responde `201` com `isFeatured: true`

### Requirement: Validação dos atributos do produto
O sistema MUST rejeitar com `400`, retornando os códigos de erro de validação no corpo e sem gravar nada, um produto em que: `name`, após remover espaços das extremidades, tenha menos de 3 ou mais de 255 caracteres; `slug` informado não seja um identificador de URL válido (letras minúsculas, dígitos e hifens simples, sem hífen nas extremidades); `sku` tenha mais de 40 caracteres; `description` tenha mais de 5000 caracteres; `unit` tenha mais de 40 caracteres; `priceCents` não seja um inteiro maior ou igual a 1 (código `MONEY_CENTS_INVALID`); `listPriceCents` informado não seja um inteiro maior ou igual a 1; ou `categoryId` esteja ausente. O `name` MUST ser gravado sem os espaços das extremidades.

#### Scenario: Preço zero
- **WHEN** um administrador envia um produto com `priceCents: 0`
- **THEN** o sistema responde `400` com `MONEY_CENTS_INVALID` e nenhum produto é criado

#### Scenario: Nome curto
- **WHEN** um administrador envia `name: "  Ab  "`
- **THEN** o sistema responde `400` com o código de nome curto demais

#### Scenario: Nome com espaços nas extremidades
- **WHEN** um administrador cria um produto com `name: "  Borracha Branca  "`
- **THEN** o produto é gravado com `name: "Borracha Branca"`

### Requirement: Preço "De:" maior que o preço de venda
Quando `listPriceCents` for informado, ele MUST ser estritamente maior que `priceCents`; caso contrário o sistema MUST responder `400` com o código `PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE`. `listPriceCents` ausente ou `null` MUST ser aceito.

#### Scenario: Preço "De:" menor ou igual
- **WHEN** um administrador envia `priceCents: 1000` e `listPriceCents: 1000`, ou `priceCents: 1000` e `listPriceCents: 900`
- **THEN** o sistema responde `400` com `PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE`

#### Scenario: Preço "De:" válido
- **WHEN** um administrador envia `priceCents: 1000` e `listPriceCents: 1290`
- **THEN** o produto é criado com os dois preços

### Requirement: Imagens ordenadas do produto
Um produto SHALL ter de 0 a 10 imagens, cada uma com `thumbUrl` e `largeUrl` http(s). Mais de 10 imagens MUST responder `400` com o código `PRODUCT_IMAGES_LIMIT_EXCEEDED`; URL inválida MUST responder `400`. O sistema MUST normalizar o `order` das imagens para a sequência `0..n-1`, preservando a ordem relativa dos valores de `order` recebidos (empates mantêm a ordem da lista). A imagem principal do produto é a de menor `order`.

#### Scenario: Mais de 10 imagens
- **WHEN** um administrador envia um produto com 11 imagens
- **THEN** o sistema responde `400` com `PRODUCT_IMAGES_LIMIT_EXCEEDED`

#### Scenario: Normalização da ordem
- **WHEN** um administrador envia imagens A com `order: 5`, B com `order: 2` e C com `order: 9`
- **THEN** o produto é gravado com B `order: 0`, A `order: 1` e C `order: 2`, e B é a imagem principal

### Requirement: Slug único derivado do nome
O `slug` SHALL identificar unicamente um produto no catálogo. Quando não informado, o sistema MUST derivá-lo do nome (minúsculas, sem acentos, palavras separadas por hífen). Criar ou alterar um produto com um slug já usado por outro produto MUST responder `409` com `PRODUCT_SLUG_ALREADY_EXISTS`; na alteração, o slug do próprio produto MUST NOT ser considerado conflito. O slug de um produto excluído continua reservado.

#### Scenario: Slug derivado
- **WHEN** um administrador cria um produto `name: "Papel Sulfite A4 Chamex"` sem `slug`
- **THEN** o produto é criado com `slug: "papel-sulfite-a4-chamex"`

#### Scenario: Slug duplicado
- **WHEN** um administrador cria um produto com o slug de outro produto existente
- **THEN** o sistema responde `409` com `PRODUCT_SLUG_ALREADY_EXISTS` e nada é criado

#### Scenario: Alteração mantendo o próprio slug
- **WHEN** um administrador altera o preço de um produto reenviando o mesmo `slug`
- **THEN** o sistema responde `200` com o produto alterado

### Requirement: SKU único quando informado
O `sku` é opcional. Quando informado, MUST ser único entre os produtos; criar ou alterar um produto com o sku de outro produto MUST responder `409` com `PRODUCT_SKU_ALREADY_EXISTS`, ignorando o próprio produto na alteração. Vários produtos sem sku MUST ser aceitos. O sku de um produto excluído continua reservado.

#### Scenario: SKU duplicado
- **WHEN** um administrador cria um produto com `sku: "026106"` e já existe outro produto com esse sku
- **THEN** o sistema responde `409` com `PRODUCT_SKU_ALREADY_EXISTS`

#### Scenario: Produtos sem SKU
- **WHEN** um administrador cria dois produtos válidos sem `sku`
- **THEN** ambos são criados com `sku: null`

### Requirement: Marca opcional e categoria obrigatória
Quando `brandId` for informado, a marca MUST existir e não estar excluída; caso contrário o sistema MUST responder `404` com `BRAND_NOT_FOUND`. `categoryId` MUST referenciar uma categoria existente e não excluída, de qualquer nível da hierarquia; caso contrário o sistema MUST responder `404` com `CATEGORY_NOT_FOUND`. As mesmas regras valem na alteração.

#### Scenario: Marca inexistente
- **WHEN** um administrador cria um produto com um `brandId` que não existe
- **THEN** o sistema responde `404` com `BRAND_NOT_FOUND` e nada é criado

#### Scenario: Categoria inexistente
- **WHEN** um administrador cria um produto com um `categoryId` que não existe
- **THEN** o sistema responde `404` com `CATEGORY_NOT_FOUND` e nada é criado

#### Scenario: Categoria de primeiro nível
- **WHEN** um administrador cria um produto na categoria raiz "Escolar"
- **THEN** o produto é criado com `categoryPath: "Escolar"`

### Requirement: Listagem paginada de produtos
`GET /products` SHALL retornar `{ items, total, page, pageSize, totalPages }`, com os produtos não excluídos ordenados por nome. Cada item MUST conter `id`, `name`, `slug`, `sku`, `brandName`, `categoryPath`, `priceCents`, `listPriceCents`, `mainImageUrl` (miniatura da imagem principal ou `null`), `isActive` e `isFeatured`.

Regras de paginação:
- `page` MUST ter padrão `1` e `pageSize` padrão `20`;
- `pageSize` acima de `100` MUST ser limitado a `100`;
- `page` ou `pageSize` ausentes, não inteiros ou menores que `1` MUST assumir o padrão;
- `totalPages` MUST ser `ceil(total / pageSize)`;
- uma página além da última MUST retornar `items` vazio, com `total` e `totalPages` corretos.

#### Scenario: Primeira página padrão
- **WHEN** um administrador chama `GET /products` com 1.076 produtos cadastrados
- **THEN** recebe 20 itens ordenados por nome, `total: 1076`, `page: 1`, `pageSize: 20` e `totalPages: 54`

#### Scenario: pageSize acima do máximo
- **WHEN** um administrador chama `GET /products?pageSize=500`
- **THEN** recebe no máximo 100 itens e `pageSize: 100`

#### Scenario: Destaque na listagem
- **WHEN** um administrador lista produtos que incluem um produto em destaque
- **THEN** o item desse produto traz `isFeatured: true` e os demais `isFeatured: false`

### Requirement: Filtros da listagem de produtos
`GET /products` SHALL aceitar os filtros `search`, `brandId`, `categoryId` e `isActive` (`true`/`false`), combinados entre si (todos precisam ser atendidos), com `total` e `totalPages` calculados sobre o resultado filtrado. `search` MUST casar, sem distinção de maiúsculas, trechos de `name`, `slug` ou `sku`. `categoryId` MUST incluir os produtos da categoria informada e de todas as suas subcategorias descendentes. `isActive` com outro valor MUST ser ignorado.

#### Scenario: Busca por trecho
- **WHEN** um administrador chama `GET /products?search=CANETA`
- **THEN** recebe apenas produtos cujo nome, slug ou sku contém "caneta", com `total` igual à quantidade encontrada

#### Scenario: Categoria com descendentes
- **WHEN** um administrador chama `GET /products?categoryId=<departamento "Escolar">`
- **THEN** recebe os produtos cadastrados em "Escolar" e em qualquer grupo ou subgrupo abaixo dele

#### Scenario: Filtros combinados
- **WHEN** um administrador chama `GET /products?brandId=<Faber-Castell>&isActive=false`
- **THEN** recebe apenas produtos inativos da marca Faber-Castell

### Requirement: Busca de produto por id
`GET /products/:id` SHALL retornar `200` com o produto completo (mesmo formato da criação) quando ele existir e não estiver excluído, com as imagens ordenadas por `order`. Caso contrário MUST responder `404`.

#### Scenario: Produto existente
- **WHEN** um administrador chama `GET /products/<id existente>`
- **THEN** recebe `200` com o produto, `brandName`, `categoryPath` e as imagens em ordem

#### Scenario: Produto inexistente
- **WHEN** um administrador chama `GET /products/<id desconhecido>`
- **THEN** recebe `404`

### Requirement: Alteração de produto
`PUT /products/:id` SHALL aplicar ao produto todos os atributos enviados, com as mesmas validações e regras de unicidade, marca e categoria da criação, e responder `200` com o produto completo.

Regras:
- **Imagens:** a lista enviada MUST substituir integralmente a anterior. Omitir `images` ou enviar lista vazia deixa o produto sem imagens.
- **Destaque:** `isFeatured` omitido MUST manter o valor atual.
- **Campos fixos:** `id` e `createdAt` MUST NOT mudar, e `updatedAt` MUST ser atualizado.
- **Id que nunca existiu:** MUST ser tratado como criação com esse `id` (responde `200` com o produto criado).
- **Id de produto excluído:** MUST responder `404` com `PRODUCT_NOT_FOUND`.

#### Scenario: Substituição de imagens
- **WHEN** um produto tem as imagens A, B e C e um administrador envia `PUT` com as imagens C e D
- **THEN** o produto passa a ter exatamente C (`order: 0`) e D (`order: 1`)

#### Scenario: Alteração com preço "De:" inválido
- **WHEN** um administrador envia `PUT` com `listPriceCents` menor que `priceCents`
- **THEN** o sistema responde `400` com `PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE` e o produto permanece inalterado

#### Scenario: Marcar e manter destaque
- **WHEN** um administrador envia `PUT` com `isFeatured: true` e depois outro `PUT` sem `isFeatured`, alterando só o preço
- **THEN** as duas respostas trazem `isFeatured: true`

### Requirement: Exclusão lógica de produto
`DELETE /products/:id` SHALL marcar o produto como excluído e responder `204`. A partir daí o produto MUST NOT aparecer em `GET /products`, `GET /products/:id` MUST responder `404`, e ele MUST NOT contar como produto da sua marca ou categoria. Excluir um id inexistente ou já excluído MUST responder `404` com `PRODUCT_NOT_FOUND`.

#### Scenario: Exclusão
- **WHEN** um administrador exclui um produto existente
- **THEN** o sistema responde `204`, `GET /products/:id` passa a responder `404` e o produto some da listagem

#### Scenario: Exclusão de produto inexistente
- **WHEN** um administrador chama `DELETE /products/<id desconhecido>`
- **THEN** o sistema responde `404` com `PRODUCT_NOT_FOUND`

### Requirement: Seed de produtos a partir da Kalunga
O sistema SHALL fornecer uma carga de dados que grava os produtos de `apps/backend/prisma/seed/data/products.json` (marca e categoria referenciadas por slug), executando depois das cargas de marcas e categorias. O backend MUST NOT ler arquivos do CLI.

**Geração do arquivo:** o CLI (`scrape:seed`) SHALL gerar `products.json` a partir de todos os departamentos raspados da Kalunga, com 1.076 produtos. Os produtos MUST ser deduplicados pelo código da Kalunga, mantendo a primeira ocorrência, com os departamentos em ordem alfabética de arquivo.

**Campos de cada produto:**
- `sku`: o código da Kalunga;
- `slug`: o do arquivo, normalizado;
- `name`: o do arquivo;
- marca: a cujo slug é igual ao slug normalizado da marca do arquivo, ou nenhuma quando não houver correspondência;
- categoria: encontrada pelos nomes departamento → grupo → subgrupo (o grupo quando o subgrupo repete o nome do grupo), ou o departamento, com um aviso no log, quando não resolver;
- `description`: o texto da descrição, limitado a 5000 caracteres;
- `priceCents`: o preço atual × 100, arredondado;
- `listPriceCents`: o preço "De:" × 100, arredondado, somente quando maior que o preço atual; senão `null`;
- `unit`: inferida do final do nome (`"CX N UN"` → `"caixa com N"`, `"PT N UN"` → `"pacote com N"`, demais casos → `"unidade"`);
- imagens: as do arquivo, na mesma ordem, limitadas às 10 primeiras;
- `isActive`: igual à disponibilidade;
- `isFeatured`: `true` somente para os 24 produtos com mais avaliações entre os candidatos, e `false` para os demais.

**Destaques:** candidatos são os produtos disponíveis com avaliação de 4 estrelas ou mais e 10 avaliações ou mais. A ordem de escolha é a quantidade de avaliações decrescente, depois as estrelas decrescentes, depois o código.

**Slugs na carga:** um slug já usado por um produto que não está no arquivo MUST ser sufixado com `-<sku>`.

**Idempotência:** a carga MUST ser idempotente. Executá-la de novo MUST atualizar os produtos pelo sku, substituindo as imagens e o destaque, sem duplicar registros.

#### Scenario: Seed executado duas vezes
- **WHEN** as cargas de marcas, categorias e produtos são executadas em um banco vazio e depois executadas de novo
- **THEN** existem exatamente 1.076 produtos, todos com categoria e com ao menos uma imagem, nenhum com mais de 10 imagens, e exatamente 24 com `isFeatured: true`, todos ativos

#### Scenario: Slug repetido nos dados
- **WHEN** os produtos `026106` e `027242` do arquivo têm o mesmo slug
- **THEN** o primeiro mantém o slug e o segundo é gravado com o slug sufixado por `-027242`

#### Scenario: Marca ausente do cadastro
- **WHEN** um produto do arquivo tem a marca de slug `dover`, que não existe entre as marcas cadastradas
- **THEN** o produto é gravado sem marca

#### Scenario: Preço "De:" não maior que o atual
- **WHEN** um produto do arquivo tem preço "De:" menor ou igual ao preço atual
- **THEN** o produto é gravado com `listPriceCents: null`

#### Scenario: Escolha dos destaques
- **WHEN** o CLI gera o arquivo com um produto indisponível que tem mais avaliações que todos os outros, e dois produtos disponíveis empatados em quantidade de avaliações
- **THEN** o indisponível fica com `isFeatured: false`, e entre os empatados vem primeiro o de mais estrelas e, persistindo o empate, o de menor código
