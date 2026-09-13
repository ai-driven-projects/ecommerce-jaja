## Context

Ver `proposal.md` para a motivação e `specs/**` para o comportamento. Estado atual e restrições que moldam a abordagem:

- **Pré-requisitos.** Este change depende do que as funcionalidades 06, 07 e 08 entregam: `@AdminOnly()`, agregados `brand` e `category` em `modules/catalog`, `BrandPrisma`/`CategoryPrisma`, seeds de marcas (210) e categorias (12 raízes), `apiRequest`/`ApiError` em `apps/frontend/src/shared/util/api-client.util.ts`, `brand.api.ts`/`category.api.ts` e a seção "Cadastros" com "Marcas" e "Categorias". Conferido no início da aplicação (tarefa 1): tudo presente; `DeleteBrand(brandRepository)` e `DeleteCategory(categoryRepository)` recebem só o próprio repositório; `CategoryDTO.path` usa ` / `; `apiRequest<T>(path, { method, token, body })`.
- `packages/shared` não é alterado. Relevante: `Entity` (com `id`, `createdAt`, `updatedAt`, `deletedAt`, `cloneWith`), `Result`, `CrudRepository<T>` (`create`, `update`, `findById`, `delete`), e os VOs `Id`, `Alias` (regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` e `Alias.format`), `Text` (`minLength`/`maxLength`, códigos protegidos `TOO_SHORT`/`TOO_LONG` sobrescrevíveis por subclasse), `Url`, `Flag`, `Order` (inteiro ≥ 0) e `PositiveInteger` (`min` configurável). O validador `v` do frontend (`src/shared/components/form/validator`) já tem `defineArray`.
- Frontend: `PaginationControls` (`page`, `totalPages`, `totalItems`, `totalLabel`, `onPageChange`), `OrderableObjectList<TItem>` (`items`, `onChange`, `renderItem`, `setItemOrder`, `orderStartsAt`), `Combobox`, `TableCard`, `DeleteConfirmationDialog`, `FormSectionLayout` e `PageSectionHeader` existem em `src/shared/components/ui`; `formatPrice(cents)` em `src/shared/util/price.util.ts`; `catalog-routes.ts` só exporta `CATALOG_ROUTE`.
- Dados da Kalunga, conferidos com script: 1.200 entradas em 12 arquivos, 1.076 produtos únicos (códigos numéricos de até 6 dígitos); nomes de 28 a 214 caracteres; descrições até 4.833; 99 produtos com preço "De:", dos quais 3 com valor menor ou igual ao atual; nenhum preço zero; 19 indisponíveis; todos com ao menos uma imagem, porém **5 produtos com mais de 10 imagens** (11, 11, 11, 13 e 19); um par de slugs repetidos (`026106`/`027242`); marcas `dvt-comercio-importa` e `dover` fora de `brands.json`; 206 produtos com `subgroup === group`; todos os slugs de produto já passam em `Alias`.

## Goals / Non-Goals

**Goals:**
- Agregado `product` no mesmo padrão de `brand`/`category` (skills `module-*`), consumível pelo backend via `dist` sem regras duplicadas no adapter.
- Listagem que escala para milhares de produtos: paginação e filtros no banco, uma consulta de contagem e uma de página, sem N+1 para marca, categoria e imagem principal.
- Seed determinístico e idempotente que produz exatamente o mesmo catálogo a cada execução.
- Filtros da tela administrativa endereçáveis por URL, preservados no vai e volta com o formulário.

**Non-Goals:**
- Endpoint público de produtos ou integração da vitrine (`storefront.mock.ts` segue intocado).
- Busca textual avançada (full-text, ranking, acentos): `contains` sem distinção de maiúsculas atende ao volume atual.
- Upload/armazenamento de imagens, estoque, variações, parcelamento e avaliações.
- Restaurar produtos excluídos ou liberar slug/sku de excluídos.

## Decisions

### 1. Nomes das capabilities de marca e categoria
As regras de exclusão bloqueada entram como `ADDED`, e não como `MODIFIED`, porque estendem o comportamento sem reescrever requisitos existentes (o próprio prompt 07/08 diz que a regra "será adicionada no prompt 09"). Conferido na aplicação, os caminhos reais são: `catalog/brand-management` (já arquivada; reúne API e telas de marca), `catalog/category-management` (API de categoria) e `admin/catalog-categories` (tela de categorias), estas duas introduzidas pelo change `cadastro-categoria`, que **MUST ser arquivado antes deste**.
Alternativa rejeitada: colocar esses requisitos em `catalog/product-registration`. Espalharia o contrato de `DELETE /brands/:id` por duas specs.

### 2. VOs próprios do produto e códigos de erro
- `ProductName extends Text` com trim, `minLength: 3`, `maxLength: 255` e códigos `PRODUCT_NAME_TOO_SHORT`/`PRODUCT_NAME_TOO_LONG` (o `Name` do shared limita a 100 e os nomes da Kalunga chegam a 214).
- `ProductDescription extends Text`, opcional, `maxLength: 5000`, código `PRODUCT_DESCRIPTION_TOO_LONG`.
- `MoneyCents`: `ValueObject<number>` que aceita apenas inteiros `>= 1`, código `MONEY_CENTS_INVALID`. Não reaproveita `PositiveInteger` diretamente para ter código próprio e nome de domínio legível; internamente pode delegar a ele.
- `ProductImage`: VO composto (`thumbUrl: Url`, `largeUrl: Url`, `order: Order`), com `withOrder(n)` para a normalização. É VO, não entidade: não tem identidade nem ciclo de vida próprio, e a lista inteira é substituída a cada gravação.
- `sku` e `unit` usam `Text` do shared com `maxLength: 40` (`sku` opcional).
- Regras entre atributos na entidade, dentro do `Result.combine`: `PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE` e `PRODUCT_IMAGES_LIMIT_EXCEEDED`.
Os códigos novos que o frontend não traduz caem na mensagem genérica de `describeApiError`; o formulário os barra antes no cliente.

### 3. Normalização de imagens e imagem principal na entidade
`Product.tryCreate` ordena as imagens recebidas por `order` com ordenação estável (empates preservam a posição na lista) e reatribui `order = índice`. `mainImage` retorna `images[0] ?? null`. Assim o adapter, o seed e o formulário não precisam repetir a regra, e `@@unique([productId, order])` no banco nunca é violado por entrada do usuário.

### 4. Slug e sku: unicidade no caso de uso e reserva por índice único
`SaveProduct` consulta `findBySlug`/`findBySku` (que ignoram excluídos) e falha com os códigos de conflito, ignorando o próprio `id`. O banco mantém `slug @unique` e `sku @unique` sobre todas as linhas, inclusive excluídas, como o prompt pede. Para não vazar `500` quando o slug/sku pertence a um produto excluído, `ProductPrisma.create/update` traduz `P2002` pelo campo alvo: `slug` → `PRODUCT_SLUG_ALREADY_EXISTS`, `sku` → `PRODUCT_SKU_ALREADY_EXISTS`, `id` → `PRODUCT_NOT_FOUND`. Consequência observável (especificada): slug/sku de excluído continua reservado, e `PUT` no id de um excluído responde `404`.
Alternativa rejeitada: índice único parcial `WHERE deleted_at IS NULL` via SQL manual. Resolve a reserva, mas o Prisma não o representa no schema (drift a cada `migrate dev`) e divergiria de marca/categoria.

### 5. Semântica de `PUT` segue marca e categoria
`SaveProduct` com `id` que não existe cria com esse `id` (padrão de `save-brand`/`save-category`). Mantido por consistência entre os três cadastros; o controller não faz verificação extra.

### 6. Persistência de imagens: substituição total na mesma transação
`create` usa nested write (`images: { createMany }`); `update` executa em `$transaction` (ou no `tx` recebido) `productImage.deleteMany({ productId })` + `createMany` + `product.update`. Diff por imagem foi descartado: imagens não têm identidade no domínio e a lista tem no máximo 10 itens.

### 7. Consultas de listagem e caminho da categoria
`findProducts.execute` carrega todas as categorias não excluídas em uma consulta (centenas de linhas), monta em memória um mapa `id → { name, parentId }`, e dele deriva (a) os ids descendentes quando há `categoryId` (BFS) e (b) `categoryPath` para cada item (nomes da raiz até a categoria, unidos por ` / `, igual ao `path` de `CategoryDTO`). A consulta de produtos usa `where` com `deletedAt: null`, `OR` de `contains` `mode: 'insensitive'` em `name`/`slug`/`sku`, `brandId`, `categoryId: { in }`, `isActive`; `orderBy: { name: 'asc' }` (desempate por `id` para paginação estável); `skip`/`take`; `include: { brand: { select: { name } }, images: { orderBy: { order: 'asc' }, take: 1 } }`; e `count` com o mesmo `where`, ambos em `$transaction([...])`. `findProductById` reusa o mesmo mapa de categorias.
Alternativa rejeitada: CTE recursiva em SQL para descendentes. Mais eficiente em árvores enormes, mas a árvore tem 3 níveis e poucas centenas de nós, e SQL cru quebraria o padrão dos adapters.

### 8. Normalização de paginação no controller
O controller converte a query string: `page`/`pageSize` inteiros `>= 1` ou padrão (`1`/`20`), `pageSize` limitado a `100`, `isActive` só quando `"true"`/`"false"`, strings vazias descartadas. A query recebe um filtro já válido; `totalPages = Math.ceil(total / pageSize)`.

### 9. Regras de exclusão de marca e categoria
`DeleteBrand(brandRepo, productRepo)` e `DeleteCategory(categoryRepo, productRepo)` ganham o repositório de produto no construtor. Ordem: `findById` → (categoria) `findByParentId` → `existsBy*Id` → `delete`. `existsByBrandId`/`existsByCategoryId` consideram só produtos com `deletedAt: null` e apenas o vínculo direto (a checagem de filhas já impede excluir categorias intermediárias). O `onDelete: Restrict` no banco não entra em ação porque a exclusão é lógica; ele protege apenas contra exclusão física manual.

### 10. Seed determinístico
`catalog-products.seed.ts` lê `categories/*.json` em ordem alfabética de arquivo, deduplica por `id` (primeira ocorrência) e processa os produtos nessa ordem, o que torna estável qual dos slugs repetidos recebe o sufixo. Carrega marcas (mapa `slug → id`) e categorias (mapa `raiz nome → grupo nome → subgrupo nome → id`) uma vez. Regras de conversão conforme a spec; decisões adicionais:
- **Imagens acima de 10**: mantém as 10 primeiras do arquivo (afeta 5 produtos), com log informativo; o prompt não previa o caso e a entidade não aceita mais de 10.
- **Unidade**: regex no final do nome — `/\bCX\s+(\d+)\s+UN\s*$/i` → `caixa com N`, `/\bPT\s+(\d+)\s+UN\s*$/i` → `pacote com N`, demais (incluindo `1 UN`, `BT 1 UN`, `BL 20 FL`) → `unidade`.
- **Slug**: `Alias.format(slug)`; se já atribuído a outro sku nesta execução ou existir no banco para outro sku, usa `<slug>-<sku>`.
- **Persistência**: `upsert` por `sku` dentro de uma transação por produto (`deleteMany` + `createMany` de imagens no update); `deletedAt` não é alterado no update. Valida cada produto com `Product.tryCreate` antes de gravar e aborta com mensagem clara se algum falhar, para que o seed nunca grave dados que a API rejeitaria.

### 11. Frontend: estado na URL e retorno à lista
`useProducts` lê `page`, `search`, `brandId`, `categoryId`, `isActive` de `useSearchParams`, e cada mudança de filtro chama `router.replace` com `page` removido (a busca aplica após ~300 ms sem digitação). Os links "Novo produto" e "Editar" levam a query string atual (`/admin/catalog/products/new?brandId=…&page=3`); as rotas `new/page.tsx` e `[id]/page.tsx` aguardam `searchParams` e repassam a query ao `ProductFormPage`, que volta para `CATALOG_PRODUCTS_ROUTE + '?' + query` em salvar/cancelar. Assim o retorno funciona também quando o formulário é aberto em nova aba, sem `sessionStorage`. Como `useSearchParams` exige `<Suspense>` no build estático do Next, a rota de lista envolve a página em `<Suspense>`.
Alternativa rejeitada: `router.back()`. Falha em acesso direto e não garante o refetch.

### 12. Frontend: preço em reais e imagens
O schema trabalha com `price`/`listPrice` em reais (`number`, duas casas, `listPrice` opcional com refinamento `> price`); o hook converte com `Math.round(valor * 100)` no envio e `cents / 100` na carga. As imagens do formulário são `{ thumbUrl, largeUrl }` sem `order`: a posição no `OrderableObjectList` define a ordem, e o `order` é gerado pelo índice no envio. Opções de categoria vêm de `listCategories` (lista plana com `path`) e de marca de `listBrands`, carregadas uma vez por tela e reusadas nos filtros e no formulário.

### 13. Ajustes descobertos na implementação do backend
- **Imagens sem `large` no arquivo**: 70 imagens de 48 produtos só têm `thumb`; o seed usa a URL disponível nos dois campos (imagem sem nenhuma URL seria descartada — hoje não há), antes do corte em 10.
- **Resolução de categoria no seed**: parte do departamento do arquivo (`category` do JSON), e não de `product.category.department`, que diverge em 454 produtos; mesmo critério do seed de categorias. Se o grupo não existir sob esse departamento, procura nas demais raízes. 10 produtos da Informática caem no fallback do departamento (grupos com `subgroup === group` que o seed de categorias não cria).
- **Tipos inválidos no corpo**: o controller responde `400` para `images` que não seja lista de objetos (`PRODUCT_IMAGES_INVALID`), `brandId`/`categoryId` não-string (`INVALID_ID`), `slug` não-string (`INVALID_ALIAS`), `unit` não-string (`INVALID_TEXT`) e URLs não-string (`INVALID_URL`).
- **Listagem**: `brandId`/`categoryId` malformados retornam página vazia (`200`); a ordenação por nome segue a collation do banco, com desempate por `id`.
- **Erros de FK**: `P2003` na gravação (marca/categoria removidas no meio) vira `BRAND_NOT_FOUND`/`CATEGORY_NOT_FOUND`.

### 14. Menu do Catálogo com um único item destacado
Pedido após a entrega: o módulo passa a se chamar "Catálogo de Produtos" (também no título da visão geral) e a seção dos cadastros perde o rótulo "Cadastros". As duas seções continuam existindo no código, só sem rótulo, para não alterar a regra genérica de seções do `SidebarMenu`. O `SidebarMenu` passa a destacar um único item: quando algum sub-item do módulo ativo corresponde à rota, o item principal fica só expandido (texto claro, sem fundo laranja e sem `aria-current`); sem sub-item correspondente, o principal continua destacado.
Alternativa rejeitada: nunca destacar o principal quando houver submenu. Em uma rota do módulo sem sub-item correspondente, nenhum item ficaria marcado.

## Risks / Trade-offs

- [Pré-requisitos 06/07/08 implementados com contratos diferentes do que os prompts descrevem (nomes de classes, formato de `CategoryDTO.path`, assinatura de `apiRequest`)] → a tarefa 1 confere cada contrato usado aqui antes de começar e ajusta as tarefas se divergir.
- [`contains` insensitivo sem índice faz varredura sequencial] → aceitável para ~1 mil produtos; quando o catálogo crescer, adicionar `pg_trgm` ou full-text em outro change.
- [Carregar todas as categorias por requisição de listagem] → poucas centenas de linhas; se virar gargalo, cachear o mapa no adapter com invalidação na gravação de categorias.
- [Slug/sku reservados por produtos excluídos podem surpreender o administrador] → a mensagem de conflito é a mesma; restaurar/liberar fica para um change futuro (non-goal).
- [Seed com `Product.tryCreate` depende do build de `@jaja/catalog`] → mesmo requisito já existente para backend; a tarefa de seed roda após o build.
- [`PUT` com id inexistente cria produto] → comportamento herdado por consistência; documentado na spec e coberto no `.http`.

## Migration Plan

1. Conferir os pré-requisitos (tarefa 1). Se faltarem, parar e aplicar antes `area-admin-base`, o cadastro de marca e o cadastro de categoria.
2. Executar as três partes em subagentes separados, com contexto limpo, **sequencialmente**: Negócio (tarefas 2–4) → Backend (5–8) → Frontend (9–12). Cada subagente lê `.claude/skills/skills-standards.md`; o de frontend lê também `apps/frontend/DESIGN.md`. Backend e frontend dependem do build de `@jaja/catalog`.
3. Migration `catalog_product` é aditiva (duas tabelas novas e FKs em colunas novas); rollback em desenvolvimento via `prisma migrate reset` seguido de seed. Nenhum dado existente é alterado.
