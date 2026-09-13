# Template de prompt de cadastro

`cadastro.md` é o molde dos prompts de cadastro administrativo (CRUD) na arquitetura do projeto: domínio em `modules/<module>`, adapter Prisma e controller no backend Nest e telas de lista e formulário no frontend Next. Ele consolida o padrão dos prompts `archive/07-cadastro-marca.md`, `archive/08-cadastro-categoria.md` e `archive/09-cadastro-produto.md` **e o que o código evoluiu depois deles** (listas paginadas com estado na URL, busca full-text, `errors.ts` por agregado, retorno do formulário para a mesma página, seeds lendo só `prisma/seed/data`).

Sincronizado com o código em 13/09/2026 (commit `43be7f4`).

## Como criar o próximo prompt

1. Copiar o template com o próximo número da sequência:

   ```bash
   cp openspec/extras/prompts/template/cadastro.md openspec/extras/prompts/NN-cadastro-<rotulo>.md
   ```

2. Responder o [questionário de blocos](#questionário-de-blocos): cada bloco `<!-- SE: x --> … <!-- FIM SE: x -->` é mantido (removendo só os marcadores) ou apagado inteiro. Blocos podem estar aninhados (`seed-cli` fica dentro de `seed`).
3. Substituir os [placeholders de nome](#placeholders-de-nome) com busca e troca **diferenciando maiúsculas** (`{{entity}}`, `{{Entity}}` e `{{ENTITY}}` são tokens diferentes).
4. Preencher os [placeholders de conteúdo](#placeholders-de-conteúdo) com as regras do novo cadastro.
5. Nos blocos `referencia`, expandir `<ref>`, `<Ref>` e `<REF>` para cada cadastro referenciado (ex.: `existsByBrandId` e `existsByCategoryId`; `BRAND_HAS_PRODUCTS` e `CATEGORY_HAS_PRODUCTS`). Nos blocos `itens-filhos`, trocar `<fk>` pela coluna da FK.
6. Revisar a [sequência](#sequência-o-que-o-novo-prompt-revisa-nos-anteriores) e apagar o comentário do topo do arquivo.
7. Conferir que não sobrou nada do template (a saída deve ser vazia):

   ```bash
   grep -nE '\{\{|<!--|<(ref|Ref|REF|fk)>' openspec/extras/prompts/NN-cadastro-<rotulo>.md
   ```

## Questionário de blocos

| Bloco | Manter quando o cadastro… | marca | categoria | produto |
| --- | --- | :-: | :-: | :-: |
| `slug` | tem identificador de URL derivado do nome | ✔ | ✔ | ✔ |
| `vo-proprio` | precisa de regras que os VOs do shared não cobrem (ex.: nome até 255, dinheiro em centavos) | — | — | ✔ |
| `hierarquia` | tem registros pai/filho na mesma tabela, com profundidade máxima | — | ✔ | — |
| `itens-filhos` | tem uma lista sem identidade própria, gravada e substituída junto com o registro (ex.: imagens) | — | — | ✔ |
| `referencia` | aponta para cadastros existentes (FK) e, por isso, bloqueia a exclusão deles | — | — | ✔ |
| `pendente-futuro` | será apontado por um cadastro futuro já conhecido, que vai bloquear a exclusão deste | ✔ | ✔ | — |
| `selecionavel` | será escolhido em formulários ou filtros de outros cadastros (cria `use-<entity>-options.hook.ts`) | ✔ | ✔ | — |
| `item-de-lista` | tem uma lista que precisa de um DTO resumido diferente do completo (nome de relações, imagem principal) | — | — | ✔ |
| `seed` | tem dados iniciais | ✔ | ✔ | ✔ |
| `seed-cli` | tem dados iniciais gerados pelo CLI (scraper) | ✔ | ✔ | ✔ |
| `fora-do-escopo` | precisa deixar explícito o que **não** será feito (ex.: integrar a vitrine) | — | — | ✔ |
| `novo-modulo-menu` | é o primeiro cadastro de um módulo sem a seção "Cadastros" no menu ou sem `withQuery` nas rotas | — | — | — |

## Placeholders de nome

| Placeholder | Formato | marca | categoria | produto |
| --- | --- | --- | --- | --- |
| `{{module}}` | kebab-case, uma palavra | `catalog` | `catalog` | `catalog` |
| `{{Module}}` | PascalCase | `Catalog` | `Catalog` | `Catalog` |
| `{{MODULE}}` | SCREAMING_SNAKE | `CATALOG` | `CATALOG` | `CATALOG` |
| `{{MODULO_LABEL}}` | rótulo do módulo no menu | Catálogo | Catálogo | Catálogo |
| `{{entity}}` | kebab-case singular | `brand` | `category` | `product` |
| `{{entities}}` | kebab-case plural (rotas) | `brands` | `categories` | `products` |
| `{{Entity}}` | PascalCase singular | `Brand` | `Category` | `Product` |
| `{{Entities}}` | PascalCase plural | `Brands` | `Categories` | `Products` |
| `{{entityCamel}}` | camelCase singular | `brand` | `category` | `product` |
| `{{ENTITY}}` | SCREAMING_SNAKE singular (códigos de erro) | `BRAND` | `CATEGORY` | `PRODUCT` |
| `{{ENTITIES}}` | SCREAMING_SNAKE plural | `BRANDS` | `CATEGORIES` | `PRODUCTS` |
| `{{entity_table}}` | snake_case plural (tabela) | `brands` | `categories` | `products` |
| `{{entity_snake}}` | snake_case singular (migration) | `brand` | `category` | `product` |
| `{{rotulo}}` / `{{Rotulo}}` | rótulo singular | marca / Marca | categoria / Categoria | produto / Produto |
| `{{rotulos}}` / `{{Rotulos}}` | rótulo plural | marcas / Marcas | categorias / Categorias | produtos / Produtos |
| `{{Novo}}` | concordância de "Novo" | Nova | Nova | Novo |
| `{{o}}` | vogal de gênero (`criad{{o}}`, `Ativ{{o}}`, `{{o}} própri{{o}}`) | a | a | o |
| `{{ICONE}}` | ícone do `lucide-react` | `Tag` | `FolderTree` | `Package` |

Nome composto (ex.: tabela de preços): `price-list`, `price-lists`, `PriceList`, `PriceLists`, `priceList`, `PRICE_LIST`, `PRICE_LISTS`, `price_lists`, `price_list`.

## Placeholders de conteúdo

Placeholders que completam uma frase já existente começam com `, ` ou espaço, conforme indicado, e ficam vazios quando não se aplicam.

**Contexto**

| Placeholder | O que escrever | Exemplo (produto) |
| --- | --- | --- |
| `{{AGREGADOS_EXISTENTES}}` | agregados já implementados no pacote e o que eles têm | os agregados `brand` (prompt 07) e `category` (prompt 08), com repositórios, queries, casos de uso `save-*`/`delete-*`, `errors.ts`, mocks in-memory e testes |
| `{{CADASTRO_REFERENCIA}}` / `{{NN_REFERENCIA}}` | o cadastro existente mais parecido e o número do prompt dele: `brand` (plano), `category` (hierarquia), `product` (VOs próprios, referências, itens filhos) | `brand` / 07 |
| `{{VOS_DO_MODULO}}` | VOs próprios que o módulo já tem e onde ficam (vazio se não houver) | — |
| `{{ITENS_MENU_EXISTENTES}}` | itens já presentes na seção "Cadastros" | "Marcas" e "Categorias" |
| `{{DESCRICAO_DADOS}}` | arquivo em `prisma/seed/data`, formato de cada item, referências por chave natural, volume, anomalias conhecidas, total esperado e "Não editar esses arquivos." quando forem gerados | `apps/backend/prisma/seed/data/products.json` (itens com `sku`, `slug`, `brandSlug`, `categorySlug`, …; 1.076 produtos; dois `brandSlug` sem marca) |
| `{{FORA_DO_ESCOPO}}` | o que não faz parte da funcionalidade | integrar a vitrine pública (`/`) à API |

**Negócio**

| Placeholder | O que escrever | Exemplo (produto) |
| --- | --- | --- |
| `{{CODIGOS_ERRO}}` | todos os códigos de `{{Entity}}Errors` | `PRODUCT_NOT_FOUND`, `PRODUCT_SLUG_ALREADY_EXISTS`, `PRODUCT_SKU_ALREADY_EXISTS` |
| `{{LISTA_VOS}}` | `arquivo.vo.ts` (`Classe`, regra) de cada VO | `product-name.vo.ts` (`ProductName`, texto de 3 a 255 caracteres, com trim), … |
| `{{ATRIBUTOS}}` | um item por linha, com recuo de 2 espaços: `` - `campo` — significado (obrigatório/opcional, VO e limites); unicidade; padrão `` | `` - `sku` — código interno (opcional, texto até 40 caracteres); único quando informado `` |
| `{{INVARIANTES}}` | regras que dependem só dos próprios atributos | `listPriceCents`, quando informado, maior que `priceCents`; no máximo 10 imagens |
| `{{METODOS_REPOSITORIO}}` | assinaturas extras do repositório | `findBySlug(slug)` e `findBySku(sku)` |
| `{{CAMPOS_DTO}}` | campos do DTO completo (sem as datas) | `id`, `name`, `slug`, `sku`, `brandId`, `brandName`, `categoryId`, `categoryPath`, … |
| `{{CAMPOS_LISTA}}` | campos do item de lista | `id`, `name`, `sku`, `brandName`, `categoryPath`, `priceCents`, `mainImageUrl`, `isActive` |
| `{{FILTROS_EXTRAS}}` | filtros além de `search`/`isActive`, começando com `, ` | `` , `brandId?`, `categoryId?` `` |
| `{{ORDENACAO}}` | ordem padrão da lista | nome |
| `{{CAMPOS_BUSCA}}` | campos casados pela busca | nome, slug e sku |
| `{{REGRAS_FILTROS_EXTRAS}}` | regras dos filtros extras, começando com espaço | `` `categoryId` inclui as subcategorias descendentes. `` |
| `{{REPOSITORIOS_REFERENCIADOS}}` | repositórios extras do `save` | `brand` e `category` |
| `{{CAMPOS_ENTRADA}}` | campos de `Save{{Entity}}Input` depois de `id?` | `name, slug?, sku?, brandId?, categoryId, …` |
| `{{VERIFICACOES}}` | uma verificação por linha, com recuo de 5 espaços: `     - regra → CÓDIGO` | `     - sku informado é único → PRODUCT_SKU_ALREADY_EXISTS` |
| `{{PADROES_CRIACAO}}` | valores padrão na criação | `isActive = true`, `unit = "unidade"` e `images = []` |
| `{{VERIFICACOES_EXCLUSAO}}` | verificações antes do soft delete (ou "sem verificações adicionais") | sem verificações adicionais |
| `{{DEPENDENTE_FUTURO}}` | agregado futuro que vai bloquear a exclusão | (em marca) `product` |
| `{{REFERENCIAS}}` | cadastros referenciados | `brand` e `category` |
| `{{CODIGOS_REFERENCIA_NAO_ENCONTRADA}}` | falhas de referência inexistente | `BRAND_NOT_FOUND` e `CATEGORY_NOT_FOUND` |
| `{{REGRAS_PENDENTES_ANTERIORES}}` | outras regras anunciadas como "será adicionada" em prompts anteriores (ou vazio) | — |
| `{{ITENS_FILHOS}}` / `{{ITEM_FILHO_VO}}` / `{{CAMPOS_ITEM_FILHO}}` / `{{MAX_ITENS_FILHOS}}` | nome da lista, VO do item, campos e limite | imagens / `ProductImage` / `thumbUrl` (`Url`) e `largeUrl` (`Url`) / 10 |
| `{{ITEM_FILHO_MODEL}}` | model Prisma dos itens filhos | `ProductImage` |
| `{{PROFUNDIDADE_MAXIMA}}` | níveis da hierarquia | (em categoria) 3 |
| `{{CASOS_ENTIDADE}}` / `{{CASOS_USE_CASE}}` | cenários de teste | nome curto, preço zero, … / criação, marca inexistente, … |

**Backend**

| Placeholder | O que escrever | Exemplo (produto) |
| --- | --- | --- |
| `{{DETALHES_MODEL}}` | chaves únicas, tipos, padrões e índices | `slug` único; `sku` único e opcional; `priceCents Int`; `unit` com padrão `"unidade"` |
| `{{MAPA_UNIQUE}}` | constraint → código | `` `products_slug_key` → `PRODUCT_SLUG_ALREADY_EXISTS`, `products_sku_key` → `PRODUCT_SKU_ALREADY_EXISTS` `` |
| `{{CAMPOS_PESO_A}}` / `{{CAMPOS_PESO_B}}` | colunas da busca por peso | `name`, `slug` e `sku` / `description` |
| `{{COLUNA_ORDEM}}` | coluna da ordenação padrão | `name` |
| `{{DETALHES_QUERY}}` | regras extras da listagem, começando com espaço (ou vazio) | `` Para `categoryId`, resolver os ids descendentes a partir das categorias carregadas. `` |
| `{{QUERY_EXTRAS}}` | query params extras, começando com `&` | `&brandId=&categoryId=` |
| `{{CODIGOS_404}}` / `{{CODIGOS_409}}` | códigos por status | `PRODUCT_NOT_FOUND`, `BRAND_NOT_FOUND`, `CATEGORY_NOT_FOUND` / `PRODUCT_SLUG_ALREADY_EXISTS`, `PRODUCT_SKU_ALREADY_EXISTS` |
| `{{CHAVE_NATURAL}}` | chave do `upsert` do seed | `sku` |
| `{{REGRAS_SEED}}` | resolução de referências por chave natural, colisões e avisos | `brandSlug`/`categorySlug` → id por mapa carregado com `findMany`; slug em uso por outro sku recebe o sufixo `-<sku>` |
| `{{SEED_ANTERIOR}}` | task que precisa rodar antes | `catalog-categories` |
| `{{REGRAS_CLI}}` | comando que gera o arquivo, origem e normalizações feitas no CLI | `scrape:seed` converte `apps/cli/data/kalunga/categories/*.json`, deduplicando por código e convertendo preços para centavos |
| `{{CONFERENCIA_SEED}}` | o que conferir no banco | que a tabela `products` tem 1.076 registros, todos com ao menos uma imagem |
| `{{CENARIOS_HTTP}}` | cenários além dos fixos do template | criação sem marca (201), marca inexistente (404), preço zero (400), sku duplicado (409) |

**Frontend**

| Placeholder | O que escrever | Exemplo (produto) |
| --- | --- | --- |
| `{{CODIGOS_I18N}}` | códigos novos deste cadastro e os `<REF>_HAS_*` | `PRODUCT_NOT_FOUND`, …, `BRAND_HAS_PRODUCTS` e `CATEGORY_HAS_PRODUCTS` |
| `{{CAMPOS_SCHEMA}}` | campos do schema com VOs e limites | `name` (3–255), `slug` (`Alias`), `price`/`listPrice` em reais com refinamento `listPrice > price`, … |
| `{{FILTROS_URL}}` | filtros extras na URL, começando com `, ` | `` , `brandId`, `categoryId` e `isActive` `` |
| `{{CONVERSOES_FORM}}` | conversões no envio, começando com `, ` (ou vazio) | `, convertendo reais em centavos` |
| `{{MAPA_ERRO_CAMPO}}` | código → campo | `PRODUCT_SLUG_ALREADY_EXISTS` → `slug`, `BRAND_NOT_FOUND` → `brandId` |
| `{{HOOKS_OPCOES}}` | hooks de opções usados | `useBrandOptions` e `useCategoryOptions` |
| `{{FILTROS_TELA}}` | filtros extras na barra, começando com `, ` (ou vazio) | ``, `Combobox` de marca, `Combobox` de categoria (rótulo = `path`) e seletor de status`` |
| `{{COLUNAS_LISTA}}` | colunas da tabela | miniatura (ou placeholder em `bg-surface`), nome, sku, marca, categoria e preço com `formatPrice` |
| `{{SECOES_FORM}}` | seções do formulário e seus campos | **Identificação** (`name`, `slug`, `sku`), **Classificação** (`brandId`, `categoryId`), **Preço** (`price`, `listPrice`, `unit`), … |
| `{{POSICAO_MENU}}` | posição do item no menu | após "Categorias" |
| `{{CONFERENCIA_NAVEGADOR}}` | fluxos a conferir no navegador | a listagem paginada com os produtos do seed, filtros refletidos na URL, criação com imagens, edição e exclusão |

## Sequência: o que o novo prompt revisa nos anteriores

Cada cadastro novo pode mudar os já existentes. Antes de fechar o prompt, conferir:

- **Contexto acumulado:** `{{AGREGADOS_EXISTENTES}}`, `{{VOS_DO_MODULO}}` e `{{ITENS_MENU_EXISTENTES}}` listam tudo o que existe até o prompt anterior.
- **Regras prometidas:** procurar nos prompts anteriores (os já implementados ficam em `openspec/extras/prompts/archive/`) frases como "será adicionada no prompt NN" e cumpri-las em `{{REGRAS_PENDENTES_ANTERIORES}}` ou no bloco `referencia`.
- **Exclusão bloqueada:** ao referenciar um cadastro, o prompt altera o `delete-<ref>.use-case` dele, os testes, o controller (`409`), as mensagens i18n e a tela (toast de erro).
- **Prisma:** relação inversa nos models referenciados e uma migration própria por cadastro.
- **Seeds:** a task entra em `seedTasks` depois das tasks de que depende; referências por chave natural, nunca por id.
- **Seletores:** se o cadastro referenciado ainda não tem `use-<ref>-options.hook.ts`, o novo prompt cria o hook.
- **Menu e exports:** posição do item em "Cadastros"; `modules/<module>/src/index.ts`, `data/index.ts` e `modules/<module>/index.ts` do frontend.
- **Próximos cadastros:** se um cadastro futuro já é conhecido, marcar `pendente-futuro` e `selecionavel` agora, para o prompt seguinte já encontrar a regra anunciada e o seletor pronto.

## Manutenção do template

O código é a referência do padrão; os prompts antigos não são atualizados. Quando um cadastro introduzir um padrão novo ou o código refinar um existente (novo utilitário, outro formato de seed, outra forma de paginação), atualizar `cadastro.md` e este README na mesma mudança e a data de sincronização acima.
