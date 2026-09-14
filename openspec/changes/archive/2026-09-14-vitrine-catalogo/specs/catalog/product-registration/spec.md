## MODIFIED Requirements

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
