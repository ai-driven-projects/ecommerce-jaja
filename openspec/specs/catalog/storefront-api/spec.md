# API Pública da Vitrine (Storefront API) Specification

## Purpose

Define a API pública, só de leitura, que a loja do Jaja usa para exibir o catálogo real:
- quais produtos e categorias são visíveis;
- a árvore de categorias com contagem de produtos;
- a listagem paginada com busca textual, filtros, ordenações e facetas de marca;
- o detalhe de produto por slug.

## Requirements

### Requirement: Endpoints públicos de leitura do catálogo
Os endpoints `GET /storefront/categories`, `GET /storefront/products` e `GET /storefront/products/:slug` SHALL ser acessíveis sem token. A presença de um cabeçalho `Authorization`, válido ou não, de usuário comum ou de administrador, MUST NOT alterar a resposta nem provocar `401` ou `403`. Esses endpoints MUST apenas ler dados. Nenhum deles MUST expor produtos, categorias ou marcas fora da regra de visibilidade.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /storefront/products` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `200` com a primeira página de produtos visíveis

#### Scenario: Token presente
- **WHEN** um cliente chama `GET /storefront/categories` com um token expirado e, depois, com o token de um administrador
- **THEN** as duas chamadas respondem `200` com o mesmo conteúdo de uma chamada sem token

### Requirement: Visibilidade dos produtos na loja
Um produto SHALL ser visível na loja somente quando:
- não estiver excluído;
- estiver ativo;
- sua categoria e todas as categorias ancestrais estiverem ativas e não excluídas.

Produtos não visíveis MUST NOT aparecer na listagem, nas facetas, nas contagens de categoria nem no detalhe. Uma marca inativa ou excluída MUST NOT esconder o produto: ele aparece sem marca (`brandName: null` na listagem e `brand: null` no detalhe) e fica fora das facetas de marca.

#### Scenario: Produto inativo
- **WHEN** o produto `cartucho-lexmark-dual-pack-1un-17-1un-27-10n0595-lexmark-cx-1-un`, inativo no seed, é procurado pela busca, pela sua categoria e pelo slug
- **THEN** ele não aparece em nenhuma listagem, não conta em `productCount` e `GET /storefront/products/<slug>` responde `404`

#### Scenario: Categoria ancestral inativa
- **WHEN** um administrador inativa uma categoria raiz
- **THEN** os produtos dela e de todas as suas subcategorias deixam de aparecer na loja, mesmo continuando ativos

#### Scenario: Marca inativa
- **WHEN** um administrador inativa a marca de um produto ativo
- **THEN** o produto continua listado com `brandName: null` e a marca some das facetas

### Requirement: Árvore de categorias da loja
`GET /storefront/categories` SHALL retornar as categorias raiz como uma árvore. Cada nó MUST conter `slug`, `name`, `level` (1 para raiz, 2 para filha e 3 para neta), `parentSlug` (`null` na raiz), `isHighlighted`, `productCount` e `children`. `productCount` MUST contar os produtos visíveis da própria categoria e de todas as descendentes.

A árvore MUST omitir:
- as categorias inativas ou excluídas, com todas as suas descendentes;
- as categorias com `productCount` igual a `0`.

Categorias irmãs MUST ser ordenadas pela ordem cadastrada, depois pelo nome sem distinção de maiúsculas e acentos.

#### Scenario: Raízes do seed
- **WHEN** um cliente chama `GET /storefront/categories` com o catálogo do seed
- **THEN** recebe as 12 categorias raiz com `level: 1`, cada uma com `productCount` igual à soma dos produtos visíveis na raiz e em toda a sua subárvore

#### Scenario: Categoria sem produtos
- **WHEN** uma subcategoria ativa não tem produtos visíveis nela nem nas descendentes
- **THEN** ela não aparece na árvore

### Requirement: Listagem pública paginada de produtos
`GET /storefront/products` SHALL responder `200` com `{ items, total, page, pageSize, totalPages, brandFacets }`, considerando só produtos visíveis. Cada item MUST conter:
- `id`, `slug`, `name` e `unit`;
- `brandName` e `categoryName` (nome da categoria do produto);
- `rootCategorySlug` (slug da categoria raiz da árvore do produto);
- `priceCents` e `listPriceCents`;
- `discountPercent`;
- `thumbUrl` (miniatura da imagem principal, ou `null` sem imagens);
- `isFeatured`.

`discountPercent` MUST ser `round((1 - priceCents / listPriceCents) × 100)` quando houver `listPriceCents`, e `null` caso contrário.

Regras de paginação:
- `page` MUST ter padrão `1` e `pageSize` padrão `24`;
- `pageSize` acima de `48` MUST ser limitado a `48`;
- valores ausentes, não inteiros ou menores que `1` MUST assumir o padrão;
- `totalPages` MUST ser `ceil(total / pageSize)`;
- uma página além da última MUST retornar `items` vazio, com `total` e `totalPages` corretos.

#### Scenario: Primeira página padrão
- **WHEN** um cliente chama `GET /storefront/products` com o catálogo do seed (1.076 produtos, 19 inativos)
- **THEN** recebe 24 itens, `total: 1057`, `page: 1`, `pageSize: 24` e `totalPages: 45`

#### Scenario: pageSize acima do máximo
- **WHEN** um cliente chama `GET /storefront/products?pageSize=500`
- **THEN** recebe no máximo 48 itens e `pageSize: 48`

#### Scenario: Percentual de desconto
- **WHEN** um produto visível tem `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** o item exibe `discountPercent: 19`, e um produto sem preço "De:" exibe `discountPercent: null`

### Requirement: Busca textual de produtos
O parâmetro `search` SHALL filtrar os produtos por texto livre, com as seguintes regras:
- **Campos:** nome, código (sku), nome da marca, nomes da categoria do produto e de suas ancestrais, e descrição.
- **Espaços:** removidos das extremidades.
- **Termos:** o texto é dividido em termos formados só por letras e dígitos, sem distinção de maiúsculas nem de acentos. Termos além do décimo são ignorados.
- **Casamento:** cada termo MUST casar o início de alguma palavra em qualquer um dos campos, e todos os termos MUST casar. Termos diferentes MAY casar campos diferentes.
- **Sem termos válidos:** `search` MUST ser ignorado.
- **Relevância:** casar nome, código ou marca vale mais que casar categorias, e casar categorias vale mais que casar a descrição.

#### Scenario: Termos em campos diferentes
- **WHEN** um cliente chama `GET /storefront/products?search=caneta bic`
- **THEN** recebe produtos em que "caneta" e "bic" começam palavras nos campos pesquisáveis, incluindo as canetas da marca BIC, e nenhuma caneta de outra marca que não mencione "bic"

#### Scenario: Acentos, maiúsculas e prefixo
- **WHEN** um cliente chama `GET /storefront/products?search=CAFÉ`
- **THEN** recebe os mesmos produtos que `search=cafe`, incluindo os que têm palavras como "cafeteira"

#### Scenario: Busca por código, categoria e descrição
- **WHEN** um cliente busca pelo sku de um produto visível, pelo nome de uma subcategoria ou por uma palavra que só aparece na descrição de um produto
- **THEN** cada busca retorna o respectivo produto

#### Scenario: Sem termos válidos
- **WHEN** um cliente chama `GET /storefront/products?search=%20%21`
- **THEN** recebe a mesma listagem de uma chamada sem `search`

### Requirement: Filtros da listagem pública
`GET /storefront/products` SHALL aceitar os filtros abaixo, combinados entre si (todos precisam ser atendidos), com `total` e `totalPages` calculados sobre o resultado filtrado:
- **`category`:** slug de uma categoria. Inclui os produtos dela e de todas as descendentes. Slug inexistente ou de categoria não visível MUST retornar uma página vazia com `200`.
- **`brand`:** slugs de marca separados por vírgula. O produto atende quando é de qualquer uma delas. Slugs vazios ou desconhecidos MUST ser ignorados, e só os 20 primeiros MUST ser considerados.
- **`minPriceCents` e `maxPriceCents`:** limites inclusivos sobre `priceCents`. Valores que não sejam inteiros maiores ou iguais a `0` MUST ser ignorados. Se o mínimo for maior que o máximo, os dois MUST ser trocados.
- **`onSale=true`:** só produtos com preço "De:".
- **`featured=true`:** só produtos em destaque.

Qualquer outro valor de `onSale` ou `featured` MUST ser ignorado.

#### Scenario: Categoria com descendentes
- **WHEN** um cliente chama `GET /storefront/products?category=cartuchos-toners`
- **THEN** recebe os produtos visíveis da raiz "Cartuchos & Toners" e de todas as suas subcategorias

#### Scenario: Categoria inexistente
- **WHEN** um cliente chama `GET /storefront/products?category=papelaria`
- **THEN** recebe `200` com `items: []` e `total: 0`

#### Scenario: Faixa de preço invertida
- **WHEN** um cliente chama `GET /storefront/products?minPriceCents=5000&maxPriceCents=1000`
- **THEN** recebe só produtos com `priceCents` entre 1000 e 5000, inclusive

#### Scenario: Ofertas
- **WHEN** um cliente chama `GET /storefront/products?onSale=true&pageSize=48`
- **THEN** recebe 48 itens, todos com `listPriceCents` e `discountPercent` preenchidos, e `total: 96`

### Requirement: Ordenação da listagem pública
O parâmetro `sort` SHALL aceitar os valores abaixo:

| `sort` | Ordem |
| --- | --- |
| `relevance` | mais relevantes para a busca primeiro |
| `featured` | produtos em destaque primeiro |
| `price-asc` | menor preço primeiro |
| `price-desc` | maior preço primeiro |
| `name` | nome |
| `discount` | maior `discountPercent` primeiro, produtos sem desconto por último |

Regras:
- **Padrão:** sem `sort` ou com valor desconhecido, vale `relevance` quando há busca e `featured` quando não há. `relevance` sem busca MUST ordenar como `featured`.
- **Desempate:** toda ordenação MUST desempatar pelo nome, sem distinção de maiúsculas e acentos, e depois por um identificador estável, de modo que páginas consecutivas nunca repitam nem pulem produtos.

#### Scenario: Padrão sem busca
- **WHEN** um cliente chama `GET /storefront/products`
- **THEN** os 24 produtos em destaque do seed vêm antes de qualquer produto sem destaque

#### Scenario: Menor preço
- **WHEN** um cliente chama `GET /storefront/products?sort=price-asc`
- **THEN** os itens vêm em ordem crescente de `priceCents` e, entre preços iguais, em ordem de nome

#### Scenario: Valor inválido
- **WHEN** um cliente chama `GET /storefront/products?sort=aleatorio`
- **THEN** recebe a mesma ordem de uma chamada sem `sort`

### Requirement: Facetas de marca
A resposta de `GET /storefront/products` SHALL trazer em `brandFacets` as marcas ativas e não excluídas presentes no resultado, cada uma com `slug`, `name` e `count` (quantidade de produtos). As facetas MUST ser calculadas com todos os filtros e a busca aplicados, **exceto** o filtro `brand`, de modo que marcas já selecionadas e marcas alternativas continuem disponíveis. Elas MUST ser ordenadas por `count` decrescente e depois por nome, e ter no máximo 30 marcas.

#### Scenario: Filtro de marca não reduz as facetas
- **WHEN** um cliente chama `GET /storefront/products?search=toner` e depois `GET /storefront/products?search=toner&brand=hp`
- **THEN** as duas respostas trazem as mesmas `brandFacets`, enquanto `items` da segunda só contém produtos da marca HP

### Requirement: Detalhe público de produto por slug
`GET /storefront/products/:slug` SHALL responder `200` com o produto visível de mesmo slug, contendo:
- `id`, `slug`, `name`, `sku`, `description` e `unit`;
- `priceCents`, `listPriceCents` e `discountPercent`;
- `isFeatured`;
- `brand` (`{ slug, name }` ou `null`);
- `categories` (`{ slug, name }` da categoria raiz até a categoria do produto);
- `images` (todas, com `thumbUrl`, `largeUrl` e `order`, ordenadas por `order`).

Slug inexistente, de produto excluído ou de produto não visível MUST responder `404` com o código `PRODUCT_NOT_FOUND`.

#### Scenario: Produto com várias imagens
- **WHEN** um cliente chama `GET /storefront/products/cabeca-de-impressao-magenta-ciano-c9383a-hp-cx-1-un`
- **THEN** recebe `200` com as 10 imagens em ordem de `order` (0 a 9), `brand` HP e `categories` começando na raiz "Cartuchos & Toners"

#### Scenario: Produto sem marca
- **WHEN** um cliente chama `GET /storefront/products/saco-para-lixo-banheiro-34x40cm-branco-dover-rl-100-un`, produto ativo do seed cuja marca não existe no cadastro
- **THEN** recebe `200` com `brand: null`

#### Scenario: Slug inexistente
- **WHEN** um cliente chama `GET /storefront/products/nao-existe`
- **THEN** o sistema responde `404` com `PRODUCT_NOT_FOUND`
