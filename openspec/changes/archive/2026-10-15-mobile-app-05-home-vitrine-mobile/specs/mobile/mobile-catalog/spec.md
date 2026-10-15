## Purpose

Define como o app mobile do cliente Jajá lê o catálogo público da vitrine (categorias e produtos), codifica os filtros da listagem, escolhe as categorias em destaque e ilustra cada categoria raiz.

## ADDED Requirements

### Requirement: Árvore de categorias da vitrine
O app SHALL obter as categorias de `GET /storefront/categories`, sem token, como uma árvore na ordem devolvida pela API. Cada nó MUST ter `slug`, `name`, `level`, `parentSlug` (ou ausente na raiz), `isHighlighted`, `productCount` e `children`; campos a mais MUST ser ignorados. Uma resposta fora desse formato MUST virar falha inesperada, sem exceção. Depois de uma leitura bem-sucedida, o app SHALL reaproveitar a árvore enquanto estiver aberto, salvo quando a pessoa pede para atualizar; uma falha MUST NOT ser guardada.

#### Scenario: Árvore do seed
- **WHEN** a API responde `200` com a raiz "Cartuchos & Toners" (`level: 1`, `parentSlug: null`) contendo a filha "Toners HP" (`level: 2`, `isHighlighted: true`, `productCount: 12`)
- **THEN** o app tem a raiz com a filha dentro de `children`, com os mesmos valores

#### Scenario: Resposta fora do formato
- **WHEN** a API responde `200` com um nó sem `slug`
- **THEN** o resultado é a falha inesperada "Algo deu errado. Tente novamente."

#### Scenario: Árvore reaproveitada
- **WHEN** a árvore já foi lida com sucesso e a Início pede as categorias de novo sem pedir atualização
- **THEN** nenhuma nova requisição é feita; com pedido de atualização, uma nova requisição é feita

### Requirement: Produtos da vitrine por filtros
O app SHALL obter produtos de `GET /storefront/products`, sem token, enviando só os filtros definidos, com os nomes que a API aceita (`page`, `pageSize`, `search`, `category`, `brand` com slugs separados por vírgula, `minPriceCents`, `maxPriceCents`, `onSale=true`, `featured=true`, `sort`). A resposta MUST ser convertida numa página com `items`, `total`, `page`, `pageSize`, `totalPages` e `brandFacets`; cada item MUST ter `id`, `slug`, `name`, `brandName` (ou ausente), `categoryName`, `rootCategorySlug`, preço e preço "De:" em centavos, `discountPercent` (ou ausente), `unit`, `thumbUrl` (ou ausente) e `isFeatured`. Preço negativo ou resposta fora do formato MUST virar falha inesperada. Páginas de produtos MUST NOT ser reaproveitadas entre pedidos.

#### Scenario: Consulta dos destaques da Início
- **WHEN** o app pede os destaques da Início
- **THEN** a requisição é `GET /storefront/products` com exatamente `featured=true`, `sort=featured` e `pageSize=12`, sem `Authorization`

#### Scenario: Página do seed convertida
- **WHEN** a API responde `200` com um item de `priceCents: 3490`, `listPriceCents: 4990`, `discountPercent: 30`, `thumbUrl: null` e `brandName: "Master"`, e `total: 96`, `totalPages: 12`
- **THEN** o app tem o item com preço `R$ 34,90`, preço anterior `R$ 49,90`, desconto 30, sem foto, marca "Master", e a página com `total` 96 e `totalPages` 12

#### Scenario: Preço negativo
- **WHEN** a API responde `200` com um item de `priceCents: -1`
- **THEN** o resultado é a falha inesperada "Algo deu errado. Tente novamente."

### Requirement: Filtros codificados de ida e volta
O app SHALL ter uma única codificação dos filtros de produtos em pares chave/valor, usada tanto na chamada da API quanto nas rotas internas. Codificar MUST emitir só os filtros definidos (`search` sem espaços nas pontas e omitido quando vazio; `onSale` e `featured` só quando verdadeiros). Decodificar MUST ser a inversa e MUST ignorar, sem erro, chave desconhecida, `page`/`pageSize` que não sejam inteiros maiores ou iguais a 1, centavos negativos ou não inteiros, `sort` desconhecido e qualquer valor de `onSale`/`featured` diferente de `true`.

#### Scenario: Ida e volta
- **WHEN** o filtro "categoria `escolar`, só ofertas, ordem `discount`, página 2" é codificado e decodificado
- **THEN** a codificação é exatamente `category=escolar`, `onSale=true`, `sort=discount`, `page=2`, e a decodificação devolve o mesmo filtro

#### Scenario: Valores inválidos
- **WHEN** os pares `sort=aleatorio`, `page=0`, `featured=1`, `minPriceCents=-5` e `foo=bar` são decodificados
- **THEN** o filtro resultante não tem ordem, página, destaque nem preço mínimo

### Requirement: Categorias em destaque
O app SHALL escolher as categorias em destaque percorrendo a árvore em pré-ordem (cada raiz e, depois, as descendentes dela, na ordem da API), incluindo só as marcadas como destaque e com produtos, até um limite informado, e associando a cada uma o slug da raiz dela.

#### Scenario: Pré-ordem com limite
- **WHEN** a árvore tem a raiz "Artes & Pintura" com as filhas em destaque "Adesivos Stickers" e "Pincéis e Trinchas", e a raiz "Cartuchos & Toners" com a filha em destaque "Toners HP", e o limite é 2
- **THEN** o resultado é "Adesivos Stickers" e "Pincéis e Trinchas", ambas com a raiz `artes-pintura`

#### Scenario: Destaque sem produtos
- **WHEN** uma categoria marcada como destaque tem `productCount: 0`
- **THEN** ela não entra no resultado

### Requirement: Ilustração de reserva por categoria raiz
O app SHALL ter, para cada categoria raiz do catálogo, um emoji e um tom pastel de reserva iguais aos do web (`artes-pintura` 🎨 roxo, `cartuchos-toners` 🖨️ azul, `coffee-break` ☕ pêssego, `cuidados-pessoais` 🧴 menta, `envelopes-etiquetas-formularios` ✉️ amarelo, `escolar` 🎒 verde, `escrita-corretivos` ✏️ amarelo, `escritorio` 📎 pêssego, `higiene-limpeza` 🧽 menta, `informatica` 💻 roxo, `organizacao` 🗂️ verde, `papeis-pastas` 📄 azul); uma raiz desconhecida MUST usar 🛒 sobre o verde.

#### Scenario: Raiz conhecida
- **WHEN** a ilustração de `coffee-break` é pedida
- **THEN** o emoji é ☕ e o tom é o pêssego

#### Scenario: Raiz desconhecida
- **WHEN** a ilustração de `nao-existe` é pedida
- **THEN** o emoji é 🛒 e o tom é o verde
