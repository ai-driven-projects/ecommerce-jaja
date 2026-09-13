# Cadastro de Categorias (Category Management) Specification

## Purpose

Define as regras de negócio e o contrato HTTP das categorias do catálogo do Jaja: a hierarquia de até três níveis (departamento → grupo → subgrupo), a unicidade global do slug, a leitura paginada (lista plana com busca, árvore por departamento e filhas diretas), a proteção administrativa dos endpoints e a carga inicial a partir dos dados raspados da Kalunga.

## Requirements

### Requirement: Atributos da categoria
Uma categoria SHALL ter:
- `id` (uuid);
- `name`: obrigatório, de 2 a 100 caracteres após remover os espaços das pontas;
- `slug`: obrigatório, apenas letras minúsculas sem acento, dígitos e hífens simples, sem hífen nas pontas;
- `description`: opcional, até 500 caracteres;
- `parentId`: opcional; `null` indica categoria raiz;
- `order`: inteiro maior ou igual a 0, padrão `0`;
- `isHighlighted`: padrão `false`;
- `imageUrl`: opcional, apenas `http`/`https`;
- `isActive`: padrão `true`;
- `createdAt` e `updatedAt`.

Toda categoria devolvida pela API MUST conter esses campos e ainda `level` (1 para raiz, 2 para filha, 3 para neta), `path` (nomes dos ancestrais e o da própria categoria separados por `" / "`) e `childrenCount` (quantidade de filhas diretas não excluídas). Valores inválidos MUST ser rejeitados com `400` e os códigos de validação, sem persistir nada.

#### Scenario: Criação com valores padrão
- **WHEN** um administrador cria uma categoria informando apenas `name: "Escolar"`
- **THEN** a resposta é `201` com `slug: "escolar"`, `parentId: null`, `order: 0`, `isHighlighted: false`, `isActive: true`, `description: null`, `imageUrl: null`, `level: 1`, `path: "Escolar"` e `childrenCount: 0`

#### Scenario: Dados inválidos
- **WHEN** um administrador cria uma categoria com `name: "A"`, ou com `imageUrl: "ftp://x"`, ou com `order: -1`
- **THEN** a resposta é `400` com os códigos de validação e nenhuma categoria é criada

### Requirement: Slug único e derivado do nome
Na criação sem `slug`, ou com `slug` vazio, o sistema SHALL derivar o slug do nome: remove acentos, passa para minúsculas e troca sequências de caracteres não alfanuméricos por um hífen, sem hífen nas pontas. Um `slug` informado MUST ser convertido para minúsculas antes da validação. Na alteração sem `slug`, ou com `slug` vazio ou `null`, o slug atual MUST ser mantido. O slug MUST ser único entre todas as categorias do catálogo, em qualquer nível. O slug de uma categoria excluída continua reservado. Salvar uma categoria com slug já usado por **outra** categoria MUST responder `409` com `CATEGORY_SLUG_ALREADY_EXISTS`. Manter o próprio slug numa alteração MUST ser aceito.

#### Scenario: Slug derivado do nome
- **WHEN** um administrador cria a categoria `name: "Borrachas Técnicas"` sem slug
- **THEN** a categoria é criada com `slug: "borrachas-tecnicas"`

#### Scenario: Slug duplicado em outro ramo
- **WHEN** existe a categoria `escolar` (raiz) e um administrador cria uma subcategoria de outro departamento com `slug: "escolar"`
- **THEN** a resposta é `409` com `CATEGORY_SLUG_ALREADY_EXISTS`

#### Scenario: Slug de categoria excluída
- **WHEN** a categoria de slug `borrachas-teste` foi excluída e um administrador cria outra com `slug: "borrachas-teste"`
- **THEN** a resposta é `409` com `CATEGORY_SLUG_ALREADY_EXISTS`

#### Scenario: Alteração mantendo o próprio slug
- **WHEN** um administrador altera o nome de uma categoria sem enviar `slug`, ou enviando o mesmo slug que ela já possui
- **THEN** a resposta é `200` e o slug permanece o mesmo

### Requirement: Hierarquia de até três níveis
Quando `parentId` for informado e não vazio, ele MUST ser um uuid válido (senão `400` com `INVALID_ID`) e a categoria pai MUST existir e não estar excluída; caso contrário, a resposta MUST ser `404` com `PARENT_CATEGORY_NOT_FOUND`. `parentId` vazio ou `null` indica raiz. O nível de uma categoria é o nível da pai mais um; raízes têm nível 1. Criar ou alterar uma categoria de modo que ela ou qualquer uma de suas descendentes passe a ter nível maior que 3 MUST responder `400` com `CATEGORY_MAX_DEPTH_EXCEEDED`, sem alterar nada.

#### Scenario: Raiz, filha e neta
- **WHEN** um administrador cria a raiz "Escolar", depois "Borrachas" com `parentId` de "Escolar" e depois "Borrachas Técnicas" com `parentId` de "Borrachas"
- **THEN** as três respostas são `201`, com `level` 1, 2 e 3 e `path` igual a "Escolar", "Escolar / Borrachas" e "Escolar / Borrachas / Borrachas Técnicas"

#### Scenario: Quarto nível rejeitado
- **WHEN** um administrador cria uma categoria com `parentId` de uma categoria de nível 3
- **THEN** a resposta é `400` com `CATEGORY_MAX_DEPTH_EXCEEDED` e nada é criado

#### Scenario: Pai inexistente
- **WHEN** um administrador cria uma categoria com um `parentId` (uuid válido) que não existe ou pertence a uma categoria excluída
- **THEN** a resposta é `404` com `PARENT_CATEGORY_NOT_FOUND`

#### Scenario: Pai com id malformado
- **WHEN** um administrador cria uma categoria com `parentId: "abc"`
- **THEN** a resposta é `400` com `INVALID_ID`

#### Scenario: Mover categoria com filhas estoura a profundidade
- **WHEN** a raiz "Escolar" tem a filha "Borrachas" e um administrador altera "Escolar" para ter como pai uma categoria de nível 2 de outro departamento
- **THEN** a resposta é `400` com `CATEGORY_MAX_DEPTH_EXCEEDED`, porque "Borrachas" ficaria no nível 4, e a hierarquia permanece inalterada

### Requirement: Hierarquia sem ciclos
Uma categoria MUST NOT ter como pai a si mesma nem uma de suas descendentes. A tentativa MUST responder `400` com `CATEGORY_CYCLE`. Essa verificação MUST ocorrer antes da verificação de profundidade, de modo que o ciclo seja o erro informado mesmo quando a profundidade também seria excedida.

#### Scenario: Pai igual à própria categoria
- **WHEN** um administrador altera a categoria X informando `parentId` igual ao id de X
- **THEN** a resposta é `400` com `CATEGORY_CYCLE`

#### Scenario: Pai descendente
- **WHEN** a raiz "Escolar" tem a filha "Borrachas", que tem a filha "Borrachas Técnicas", e um administrador altera "Escolar" para ter como pai "Borrachas Técnicas"
- **THEN** a resposta é `400` com `CATEGORY_CYCLE` e a hierarquia permanece inalterada

### Requirement: Criação e alteração de categoria
`POST /categories` SHALL criar uma categoria com id gerado pelo sistema, ignorando qualquer `id` enviado no corpo, e responder `201` com a categoria completa. `PUT /categories/:id` SHALL alterar a categoria e responder `200` com a categoria completa; o id da rota prevalece sobre o do corpo. Um id de rota malformado MUST responder `400` com `INVALID_ID`. Um uuid válido que não existe cria a categoria com esse id; o id de uma categoria excluída MUST responder `404` com `CATEGORY_NOT_FOUND`. Numa alteração:
- campos omitidos MUST manter o valor atual;
- `null` ou texto vazio em `parentId`, `description` ou `imageUrl` MUST limpar o campo, e limpar `parentId` torna a categoria raiz;
- `null` em `order`, `isHighlighted` ou `isActive` MUST manter o valor atual; na criação, MUST aplicar o padrão;
- `isActive`, `isHighlighted` e `order` MUST poder ser alterados.

#### Scenario: Alteração de campos
- **WHEN** um administrador envia `PUT /categories/:id` com novo `name`, `order: 5` e `isHighlighted: true`
- **THEN** a resposta é `200` com os novos valores, `updatedAt` atualizado e `path` refletindo o novo nome

#### Scenario: Campos omitidos são mantidos
- **WHEN** uma categoria com `description: "Itens escolares"` recebe `PUT` sem o campo `description`
- **THEN** a descrição continua "Itens escolares"

#### Scenario: Mover para a raiz
- **WHEN** um administrador envia `PUT` de uma categoria de nível 2 com `parentId: null`
- **THEN** a resposta é `200` com `level: 1`, e as filhas dela passam a ter nível 2

#### Scenario: Alteração de categoria excluída
- **WHEN** um administrador envia `PUT /categories/:id` com o id de uma categoria excluída
- **THEN** a resposta é `404` com `CATEGORY_NOT_FOUND` e nada é criado

### Requirement: Lista paginada e busca de categorias
`GET /categories` SHALL devolver `200` com uma página de categorias não excluídas, de qualquer nível, no formato `{ items, total, page, pageSize, totalPages }`, cada item com `level`, `path` e `childrenCount`. Parâmetros:
- `page` (padrão 1) e `pageSize` (padrão 20, máximo 100) MUST aceitar só inteiros positivos: valores inválidos usam o padrão e `pageSize` acima do máximo MUST ser limitado a 100. Uma página além da última MUST devolver `items` vazio com `total` e `totalPages` corretos.
- `search`, quando informado, MUST funcionar como a busca de marcas: o texto é separado em termos, acentos e caixa são ignorados e cada termo MUST casar com o início de uma palavra do nome, do slug ou da descrição, com as categorias que casam no nome ou no slug antes das que casam só na descrição. Um texto sem letras nem dígitos MUST ser tratado como ausência de busca.
- `isActive=true` ou `isActive=false` MUST filtrar pelo status; outros valores são ignorados.
- `maxLevel` igual a 1, 2 ou 3 MUST limitar os itens a esse nível ou acima; outros valores são ignorados.
- `excludeSubtreeOf=<id>` MUST excluir a categoria informada e todas as suas descendentes; um id malformado é ignorado.

Sem busca, os itens MUST vir ordenados por `path`, sem distinção de maiúsculas, minúsculas e acentos. O `path` e o `level` de um item MUST considerar os ancestrais mesmo quando eles não passam nos filtros.

#### Scenario: Primeira página após o seed
- **WHEN** após o seed um administrador chama `GET /categories`
- **THEN** recebe `200` com 20 itens, `total: 1111`, `page: 1`, `pageSize: 20` e `totalPages: 56`, ordenados por `path`

#### Scenario: pageSize acima do máximo
- **WHEN** um administrador chama `GET /categories?pageSize=500`
- **THEN** recebe no máximo 100 itens e `pageSize: 100`

#### Scenario: Busca por prefixo sem acento
- **WHEN** após o seed um administrador chama `GET /categories?search=borracha tecn`
- **THEN** a lista contém "Borrachas Técnicas" com `path: "Escolar / Borrachas / Borrachas Técnicas"` e `level: 3`

#### Scenario: Filtro por status
- **WHEN** a raiz "Escolar" está inativa, sua filha "Borrachas" está ativa e um administrador chama `GET /categories?isActive=true&search=borrachas`
- **THEN** a lista contém "Borrachas" com `path: "Escolar / Borrachas"` e `level: 2`, e não contém "Escolar"

#### Scenario: Opções de categoria pai na edição
- **WHEN** um administrador chama `GET /categories?maxLevel=2&excludeSubtreeOf=<id de Escolar>&pageSize=100`
- **THEN** nenhum item tem `level: 3`, e nem "Escolar" nem qualquer categoria cujo `path` começa com "Escolar / " aparece em nenhuma página

### Requirement: Árvore paginada de categorias
`GET /categories/tree` SHALL devolver `200` com uma página de categorias **raiz** não excluídas no formato `{ items, total, page, pageSize, totalPages }`, em que `total` e `totalPages` contam só as raízes. `page` e `pageSize` seguem as regras da lista paginada. Cada item MUST ter os campos da categoria mais `children`. Com `expanded=true`, `children` MUST conter as filhas não excluídas de cada raiz e, dentro delas, as netas, formando a subárvore completa; com qualquer outro valor ou sem o parâmetro, `children` MUST vir vazio e `childrenCount` indica se há filhas a carregar. Em todos os níveis, as irmãs MUST vir ordenadas por `order` e, em empate, por nome sem distinção de maiúsculas, minúsculas e acentos.

`GET /categories/:id/children` SHALL devolver `200` com a lista (não paginada) das filhas diretas não excluídas da categoria, na mesma ordem, cada uma com `level`, `path`, `childrenCount` e `children` vazio. Se a categoria não existir, estiver excluída ou o id for malformado, a resposta MUST ser `404` com `CATEGORY_NOT_FOUND`.

#### Scenario: Árvore recolhida do seed
- **WHEN** após o seed um administrador chama `GET /categories/tree`
- **THEN** recebe 12 raízes, `total: 12`, `totalPages: 1`, a primeira com `order` 3 ("Cartuchos & Toners"), todas com `children: []` e `childrenCount` maior que zero

#### Scenario: Árvore expandida paginada
- **WHEN** após o seed um administrador chama `GET /categories/tree?expanded=true&pageSize=5`
- **THEN** recebe 5 raízes com `total: 12` e `totalPages: 3`, cada uma com `children` igual às suas filhas, e cada filha com `children` igual às suas netas

#### Scenario: Filhas diretas
- **WHEN** um administrador chama `GET /categories/<id de Escolar>/children`
- **THEN** recebe as filhas diretas de "Escolar", todas com `level: 2`, `path` começando por "Escolar / ", `children: []` e a quantidade igual ao `childrenCount` de "Escolar"

#### Scenario: Filhas de categoria inexistente
- **WHEN** um administrador chama `GET /categories/<uuid inexistente>/children`
- **THEN** a resposta é `404` com `CATEGORY_NOT_FOUND`

### Requirement: Consulta de categoria por id
`GET /categories/:id` SHALL devolver `200` com a categoria, incluindo `level`, `path` e `childrenCount`, ou `404` com `CATEGORY_NOT_FOUND` quando ela não existir, estiver excluída ou o id for malformado.

#### Scenario: Consulta de categoria existente
- **WHEN** um administrador chama `GET /categories/<id de Borrachas>`
- **THEN** a resposta é `200` com `path: "Escolar / Borrachas"`, `level: 2` e `childrenCount` igual ao número de subgrupos de "Borrachas"

#### Scenario: Consulta de categoria inexistente
- **WHEN** um administrador chama `GET /categories/:id` com um id que não existe
- **THEN** a resposta é `404`

### Requirement: Exclusão lógica de categoria
`DELETE /categories/:id` SHALL excluir a categoria de forma lógica e responder `204`. Depois disso ela MUST deixar de aparecer em todas as leituras (lista, árvore, filhas e consulta por id), MUST deixar de contar no `childrenCount` da pai e MUST deixar de ser aceita como pai. Excluir uma categoria inexistente, já excluída ou com id malformado MUST responder `404` com `CATEGORY_NOT_FOUND`. Excluir uma categoria que possui filhas não excluídas MUST responder `409` com `CATEGORY_HAS_CHILDREN`, sem excluir nada.

#### Scenario: Exclusão de folha
- **WHEN** um administrador exclui uma categoria sem filhas
- **THEN** a resposta é `204`, um `GET /categories/:id` seguinte responde `404` e o `childrenCount` da pai diminui em 1

#### Scenario: Exclusão de categoria com filhas
- **WHEN** um administrador exclui "Escolar", que tem a filha "Borrachas"
- **THEN** a resposta é `409` com `CATEGORY_HAS_CHILDREN` e as duas categorias continuam existindo

#### Scenario: Exclusão de categoria inexistente
- **WHEN** um administrador exclui um id que não existe
- **THEN** a resposta é `404` com `CATEGORY_NOT_FOUND`

### Requirement: Corpo das respostas de erro
Toda resposta de erro dos endpoints de categoria SHALL ter o corpo `{ statusCode, error, message, path, timestamp }`, em que `message` é a lista, sem repetições, dos códigos de erro (ex.: `["CATEGORY_SLUG_ALREADY_EXISTS"]`). Quando houver códigos de mais de um tipo, `404` MUST prevalecer sobre `409`, e `409` sobre `400`.

#### Scenario: Erro com códigos
- **WHEN** um administrador cria uma categoria com slug já usado
- **THEN** a resposta é `409` com `message: ["CATEGORY_SLUG_ALREADY_EXISTS"]`

### Requirement: Endpoints de categoria restritos a administradores
Todos os endpoints sob `/categories` SHALL exigir JWT válido de um usuário com `admin = true`. Sem token, ou com token inválido ou expirado, a resposta MUST ser `401`. Com token válido de usuário não administrador, a resposta MUST ser `403`.

#### Scenario: Sem token
- **WHEN** alguém chama `GET /categories/tree` sem cabeçalho `Authorization`
- **THEN** a resposta é `401`

#### Scenario: Usuário não administrador
- **WHEN** um usuário do seed com `admin = false` chama `POST /categories` com token válido
- **THEN** a resposta é `403` e nada é criado

### Requirement: Carga inicial de categorias a partir da Kalunga
O seed de desenvolvimento SHALL carregar a árvore de categorias de `apps/backend/prisma/seed/data/categories.json`, com as pais antes das filhas e referenciadas por `parentSlug`; o backend MUST NOT ler arquivos do CLI. O CLI (`scrape:seed`) SHALL gerar esse arquivo a partir dos 12 departamentos raspados da Kalunga (`apps/cli/data/kalunga/categories/<slug>.json`), seguindo as regras abaixo.
- **Raízes:** um departamento por arquivo, com nome, slug e `order` do departamento.
- **Grupos:** os grupos do próprio departamento, ou seja, com `departmentId` igual ao id do departamento, na ordem da lista, com `isHighlighted` vindo de `highlighted`.
- **Subgrupos:** um por par grupo/subgrupo citado nos produtos quando o subgrupo, sem espaços nas pontas, é diferente do grupo. O subgrupo fica sob o grupo de mesmo nome da raiz que possui esse grupo, preferindo a raiz do arquivo; os irmãos são ordenados alfabeticamente.
- **Grupos ausentes:** um grupo citado por produtos que nenhuma raiz possui MUST ser criado uma única vez, sob a raiz do arquivo em que aparece primeiro.
- **Slugs:** todo slug MUST ser normalizado para o formato válido. Quando colidir com o slug de outra categoria, MUST ser prefixado com o slug da pai (`<slug-pai>-<slug>`).
- **Idempotência:** executar o seed novamente MUST NOT criar registros novos nem trocar ids.

O resultado MUST ter 12 raízes, 708 grupos, 391 subgrupos e nenhuma categoria com nível maior que 3.

#### Scenario: Primeira carga
- **WHEN** o seed é executado com o banco sem categorias
- **THEN** existem 1.111 categorias: 12 no nível 1, 708 no nível 2 e 391 no nível 3, todas ativas e com `description` e `imageUrl` nulos

#### Scenario: Segunda carga
- **WHEN** o seed é executado de novo logo depois
- **THEN** o total continua 1.111 e os ids das categorias são os mesmos da primeira carga

#### Scenario: Slug de grupo terminado em hífen
- **WHEN** o seed processa o grupo "Papel Sulfite (Chamequinho)", cujo slug no arquivo é `papel-sulfite-chamequinho-`
- **THEN** a categoria é gravada com `slug: "papel-sulfite-chamequinho"`

#### Scenario: Slug colidindo entre departamentos
- **WHEN** os departamentos "Escolar" e "Suprimentos para Escritório" (slug `escritorio`) possuem, cada um, o grupo "Livros"
- **THEN** o grupo de "Escolar" fica com `slug: "livros"` e o de "Suprimentos para Escritório" com `slug: "escritorio-livros"`

#### Scenario: Produto de outro departamento no arquivo
- **WHEN** `escrita-corretivos.json` traz um produto com a categoria `Escolar/Borrachas/Borrachas Técnicas`
- **THEN** "Borrachas Técnicas" é criada sob o grupo "Borrachas" da raiz "Escolar", e nenhum grupo "Borrachas" é criado em "Escrita e Corretivos"

#### Scenario: Grupo que nenhuma raiz possui
- **WHEN** `artes-pintura.json` traz produtos com a categoria `Embalagens/Tesouras/<subgrupo>` e nenhuma das 12 raízes possui o grupo "Tesouras"
- **THEN** o grupo "Tesouras" é criado sob "Artes & Pintura" e os subgrupos citados ficam sob ele

### Requirement: Categoria com produtos não pode ser excluída
`DELETE /categories/:id` MUST responder `409` com o código `CATEGORY_HAS_PRODUCTS`, sem excluir a categoria, quando existir ao menos um produto não excluído associado diretamente a ela. A verificação de filhas vem antes: uma categoria com filhas MUST continuar respondendo `CATEGORY_HAS_CHILDREN`, tenha ou não produtos. Produtos já excluídos MUST NOT impedir a exclusão.

#### Scenario: Categoria folha com produtos
- **WHEN** um administrador chama `DELETE /categories/<id>` de uma categoria sem filhas e com produtos cadastrados
- **THEN** o sistema responde `409` com `CATEGORY_HAS_PRODUCTS` e a categoria continua existindo

#### Scenario: Categoria com filhas e produtos
- **WHEN** um administrador tenta excluir uma categoria que tem filhas e produtos
- **THEN** o sistema responde `409` com `CATEGORY_HAS_CHILDREN`

#### Scenario: Categoria cujos produtos foram excluídos
- **WHEN** todos os produtos de uma categoria folha foram excluídos e um administrador exclui a categoria
- **THEN** o sistema responde `204`
