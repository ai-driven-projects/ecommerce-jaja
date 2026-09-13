## Context

Ver `proposal.md` para a motivação e `specs/catalog/category-management` e `specs/admin/catalog-categories` para o comportamento. Estado e restrições que moldam a abordagem:

- **Pré-requisitos (06 e 07).** `@AdminOnly()`, o sub-item "Marcas" do módulo Catálogo, `api-client.util.ts` (`apiRequest`, `ApiError`, `toErrorMessage`), `BrandPrisma` com busca textual e paginação em SQL (`"pt-BR-x-icu"`, `ts_rank`, `folded`, `toPrefixTsQuery`, hoje locais do arquivo), `use-brands.hook.ts` (`page`/`search` na URL, debounce de 300 ms, `returnQuery` para o formulário) e `useBrandOptions` (seletor com busca na API, 20 por vez). Conferidos na tarefa 1.1.
- **Change `cadastro-produto`.** Estende `DeleteCategory` com o repositório de produtos (`CATEGORY_HAS_PRODUCTS`, mapeado para `409` no controller e exibido como toast pela tela) e consome categorias nos seletores da listagem e do formulário de produto. Esta change mantém essas extensões e migra os seletores (decisão 13).
- **`packages/shared` não muda.**
  - Fornece `Entity` (com `cloneWith`, `deletedAt`), `Result`, `CrudRepository<T>`, cujo `findById` devolve `Result<T>` e falha quando não acha, e `UseCase`.
  - VOs: `Id` (falha `INVALID_ID`), `Name` (2–100, com trim), `Alias` (regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`; `Alias.format` remove acentos, troca não alfanuméricos por hífen e apara hífens), `Text` (`minLength`/`maxLength`, com trim), `Url` (http/https), `Flag` e `Order` (inteiro ≥ 0).
- **Backend.** NestJS em ESM (`.js` nos imports). `@jaja/catalog` é consumido via `dist`. O filtro global de erros responde `{ statusCode, error, message: string[], path, timestamp }`. Seeds resolvem caminhos relativos a `import.meta.url`.
- **Frontend.** Next.js 16 (`params`/`searchParams` são `Promise`; página com `useSearchParams` fica em `<Suspense>`). `src/shared/components/ui` tem `DeleteConfirmationDialog` (`confirmDisabled`, `confirmDisabledMessage`, palavra "excluir"), `Combobox` (com `onSearchChange`, `selectedOption`, `loading`, `hasMore`, `onLoadMore`), `FormSectionLayout`, `FormSkeleton`, `TableCard`/`Table`, `PageSectionHeader`, `PaginationControls`, `EmptyListState`, `Checkbox`, `Textarea` e `Badge`. `src/shared/util/list-query.util.ts` monta a query da lista. `storefront.types.ts` já exporta um tipo `Category`.
- **Dados (`apps/cli/data/kalunga`).** 12 arquivos de departamento. A lista `category.groups` mistura grupos de outros departamentos (311), os `products[].category` citam 22 departamentos com nomes que nem sempre batem com as 12 raízes, há nomes com espaço no fim, 10 slugs de grupo terminados em hífen e o grupo "Livros" em duas raízes. A simulação da decisão 8 resulta em 12 raízes, 708 grupos (681 listados + 27 criados) e 391 subgrupos, sem nome ou slug inválido. "Escolar" tem cerca de 126 filhas diretas.

## Goals / Non-Goals

**Goals:**
- Garantir as regras de hierarquia (pai existente, sem ciclo, profundidade ≤ 3 incluindo a subárvore) no caso de uso, testáveis com o repositório in-memory.
- Nenhuma leitura da tela ou dos seletores carrega todas as categorias: cada chamada é limitada a uma página, às raízes de uma página com suas subárvores ou às filhas diretas de um nó.
- Calcular `level`, `path` e `childrenCount` num único lugar: a consulta SQL do adapter. Nenhum dos três é persistido.
- Seed determinístico e idempotente.

**Non-Goals:**
- Garantias de hierarquia no banco (trigger, closure table): o volume e a baixa concorrência administrativa não justificam.
- Paginar as filhas diretas de um nó ou cachear leituras no servidor.
- Resolver o mapeamento de produtos para categorias no seed de produtos (change `cadastro-produto`).

## Decisions

### 1. 06 e 07 como pré-requisito verificado, não reimplementado
A primeira tarefa confere a existência dos artefatos de 06 e 07 e interrompe se faltarem. Alternativa rejeitada: trazer para cá `@AdminOnly()`, `api-client.util.ts` e o menu, duplicando o escopo daquelas changes.

### 2. Entidade enxuta: invariante local, slug derivado, sem campos calculados
`Category.tryCreate` valida os VOs com `Result.combine`: `name: Name`; `slug: Alias` via `Category.resolveSlug(slug, name)` (slug em branco → `Alias.format(name)`, senão `slug.toLowerCase()`); `description: Text` opcional com `maxLength: 500`; `parentId: Id` opcional; `order: Order` padrão 0; `isHighlighted: Flag` padrão `false`; `imageUrl: Url` opcional; `isActive: Flag` padrão `true`. Getters para todos, mais `isRoot`. Os códigos ficam em `errors.ts` (`CategoryErrors`, `CATEGORY_MAX_DEPTH = 3`).

A única invariante de hierarquia na entidade é `parentId !== id`, que falha com `CATEGORY_CYCLE` (verificada depois dos VOs), o mesmo código usado pelo caso de uso para a pai descendente. `level`, `path` e `childrenCount` dependem de outras categorias e aparecem só nos DTOs.

### 3. Ordem das verificações em `SaveCategory`
`new SaveCategory(categoryRepository).execute(input): Result<{ id }>`. Fluxo:
1. **Estado atual:** sem `id` (ou vazio) → uuid v4. `Id.tryCreate` rejeita id malformado com `INVALID_ID`. `findById` com falha `CATEGORY_NOT_FOUND` significa criação com aquele id; outras falhas propagam.
2. **Valores efetivos** (decisão 4).
3. **Pai:** `parentId` malformado → `INVALID_ID`; `findById(parentId)` com `CATEGORY_NOT_FOUND` → `PARENT_CATEGORY_NOT_FOUND`. A mesma subida carrega os ancestrais da pai (limite `CATEGORY_MAX_DEPTH + 3` saltos de segurança).
4. **Ciclo**, só na alteração: o id aparece entre a pai e seus ancestrais → `CATEGORY_CYCLE`.
5. **Profundidade:** `nívelDaPai` = tamanho da cadeia (0 sem pai); `alturaDaSubárvore` por `findByParentId` recursivo (folha = 1), só na alteração, parando assim que se sabe que não cabe. `nívelDaPai + altura > 3` → `CATEGORY_MAX_DEPTH_EXCEEDED`.
6. **Slug:** na alteração, slug em branco mantém o atual; senão `Category.resolveSlug`. `findBySlug` de outra categoria → `CATEGORY_SLUG_ALREADY_EXISTS`.
7. **Grava:** `Category.tryCreate` (criação) ou `cloneWith` com `updatedAt` (alteração), depois `create`/`update`.

O ciclo vem antes da profundidade porque mover uma raiz para dentro da própria descendente quase sempre também estoura a profundidade, e o erro útil é o ciclo. Alternativa rejeitada: `path`/`depth` persistidos, que exigiriam atualização em cascata a cada movimentação.

### 4. Semântica de alteração
Na alteração, campo `undefined` mantém o valor atual. `null` ou `''` em `parentId`, `description` e `imageUrl` limpam o campo. `null` em `order`, `isHighlighted` e `isActive` mantém o valor (na criação, aplica o padrão). Slug em branco mantém o slug atual, para não quebrar URLs quando só o nome muda. `PUT` com uuid inexistente cai na criação com aquele id (upsert, como `save-brand`); o id de uma categoria excluída colide com a chave primária e o adapter devolve `CATEGORY_NOT_FOUND`. O formulário envia sempre o objeto completo.

### 5. Casos de uso devolvem o id; o controller responde com a query
`SaveCategory` devolve `{ id }`; `POST`/`PUT` respondem com `findCategoryById.execute(id)` (`null` → `404 CATEGORY_NOT_FOUND`). O cálculo de `level`/`path`/`childrenCount` não se duplica no domínio.

### 6. Leitura em SQL paginado no adapter
O repositório (`findById`, `findBySlug`, `findByParentId`, `findAll`) usa o client Prisma, sempre com `deletedAt: null`; `findByParentId`/`findAll` ordenam por `order` e `name`; id malformado → `CATEGORY_NOT_FOUND` em `findById`/`delete` e `[]` em `findByParentId`. `delete` preenche `deletedAt`.

As queries usam SQL cru (`$queryRaw`), no padrão de `BrandPrisma`, sobre uma seleção base com auto-joins, possível porque a profundidade máxima é 3:

```sql
SELECT c.*, 
  CASE WHEN c.parent_id IS NULL THEN 1 WHEN p.parent_id IS NULL THEN 2 ELSE 3 END AS level,
  concat_ws(' / ', g.name, p.name, c.name) AS path,
  (SELECT count(*)::int FROM categories k WHERE k.parent_id = c.id AND k.deleted_at IS NULL) AS children_count
FROM categories c
LEFT JOIN categories p ON p.id = c.parent_id
LEFT JOIN categories g ON g.id = p.parent_id
WHERE c.deleted_at IS NULL AND ...
```

- **`findCategories`** (`FindCategoriesQuery`): filtros `is_active`, `level <= maxLevel`, `excludeSubtreeOf` (`c.id <> $x AND c.parent_id IS DISTINCT FROM $x AND p.parent_id IS DISTINCT FROM $x`) e busca `SEARCH_DOCUMENT @@ to_tsquery('simple', ...)` sobre `c.name` e `c.slug` (peso A) e `c.description` (peso B). Ordem sem busca: `path COLLATE "pt-BR-x-icu", c.id`; com busca: `ts_rank DESC`, depois a mesma ordem. `count(*)` com o mesmo `WHERE` e `LIMIT/OFFSET`, em `Promise.all`.
- **`findCategoryTree`** (`FindCategoryTreeQuery`): raízes da página (`c.parent_id IS NULL`, ordem `c."order", c.name COLLATE "pt-BR-x-icu", c.id`) e `count` das raízes. Com `expanded`, mais duas consultas com `c.parent_id = ANY($ids)` (filhas das raízes da página e depois netas das filhas), montando `children` em memória só com essas linhas. No máximo 4 consultas por página.
- **`findCategoryChildren`** (`FindCategoryChildrenQuery`): confirma a pai pela seleção base (`null` → `404`) e devolve `c.parent_id = $id` na ordem das irmãs, com `children: []`.
- **`findCategoryById`**: seleção base com `c.id = $id`; id malformado → `null` sem consultar.

Os auxiliares de busca (`folded`, `toPrefixTsQuery`, limite de termos) saem de `brand.prisma.ts` para `apps/backend/src/modules/catalog/text-search.sql.ts`, exportados e usados pelos dois adapters, sem mudar o comportamento de marcas. Alternativas rejeitadas: carregar tudo e paginar em memória (contraria o objetivo de consultas menores); CTE recursiva (desnecessária com profundidade fixa 3).

### 7. Slug reservado após exclusão, com tradução dos erros de gravação
`slug` é `@unique` no banco, então o slug de uma categoria excluída continua ocupado, enquanto `findBySlug` ignora excluídas. `CategoryPrisma.create`/`update` traduzem os erros do Prisma: `P2002` em `slug`/`categories_slug_key` → `CATEGORY_SLUG_ALREADY_EXISTS`; `P2002` em `id`/`categories_pkey` → `CATEGORY_NOT_FOUND`; `P2003` (pai removida entre a checagem e a gravação) → `PARENT_CATEGORY_NOT_FOUND`; `P2025` → `CATEGORY_NOT_FOUND`. Alternativas rejeitadas: índice único parcial (SQL fora do schema Prisma) e renomear o slug na exclusão (diverge de `brand`).

### 8. Seed determinístico em duas fases: planejar em memória, depois gravar
`catalog-categories.seed.ts`:
1. Lê `index.json` e cada `categories[].file`, com caminho relativo a `import.meta.url`; falha com mensagem clara se faltar arquivo.
2. **Planeja** a árvore em memória, com nomes aparados: raízes na ordem do índice; grupos listados (`departmentId === category.id`) com `order` = índice na lista filtrada; para cada produto com `subgroup.trim() !== group.trim()`, o grupo dono é o de mesmo nome na raiz do arquivo se ela o possuir, senão na primeira raiz que o possua, senão é criado sob a raiz do arquivo uma vez só; grupos criados com `order` depois dos listados, em ordem alfabética; subgrupos distintos por grupo, `order` alfabética (`localeCompare('pt-BR')`).
3. **Resolve slugs** na ordem raízes → grupos listados → grupos criados → subgrupos, com `Alias.format`; slug já usado **no plano** vira `<slug-pai>-<slug>`.
4. **Grava** nível a nível com `upsert` por `slug` (`create`: uuid v4, `description`/`imageUrl` nulos, `isActive: true`; `update`: `name`, `parentId`, `order`, `isHighlighted`).
5. Registra no `seedTasks` após `seedCatalogBrands` e loga os totais por nível.

Alternativas rejeitadas: pendurar todo subgrupo na raiz do arquivo (grupos fora do lugar; decidido com o usuário) e resolver colisões consultando o banco (não idempotente).

### 9. Model Prisma
Model `Category` → `@@map("categories")`, colunas em snake_case: `id String @id @db.Uuid`, `name`, `slug @unique`, `description String?`, `parentId String? @db.Uuid`, `order Int @default(0)`, `isHighlighted Boolean @default(false)`, `imageUrl String?`, `isActive Boolean @default(true)`, `createdAt`, `updatedAt`, `deletedAt DateTime?`; `parent Category? @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Restrict)`, `children Category[] @relation("CategoryHierarchy")` e `@@index([parentId])`.

### 10. Controller
`@Controller('categories')` com `@AdminOnly()` na classe. Rotas, com `tree` declarada antes de `:id`:
- `GET /` → `findCategories`, `GET /tree` → `findCategoryTree`, `GET /:id/children` → `findCategoryChildren` (`null` → `404 CATEGORY_NOT_FOUND`), `GET /:id` → `findCategoryById`.
- `POST /` (`201`, descarta `id` do corpo), `PUT /:id` (`200`, id da rota prevalece), `DELETE /:id` (`204`).

Parâmetros no padrão de `brand.controller`: `page`/`pageSize` por `positiveInteger` (`/^\d+$/`, ≥ 1, padrões 1 e 20, `pageSize` limitado a 100); `search` só quando string não vazia após `trim`; `isActive` e `expanded` só `'true'`/`'false'` exatos; `maxLevel` só `'1'|'2'|'3'`; `excludeSubtreeOf` só quando for uuid. O corpo passa por `toInput`, que copia os 8 campos preservando `undefined`/`null`.

Mapeamento de falhas, sem repetição de códigos e com precedência 404 > 409 > 400: `CATEGORY_NOT_FOUND` e `PARENT_CATEGORY_NOT_FOUND` → `NotFoundException`; `CATEGORY_SLUG_ALREADY_EXISTS`, `CATEGORY_HAS_CHILDREN` (e `CATEGORY_HAS_PRODUCTS`, da change de produtos) → `ConflictException`; o resto (`INVALID_ID`, `CATEGORY_CYCLE`, `CATEGORY_MAX_DEPTH_EXCEEDED`, códigos de VO) → `BadRequestException`.

### 11. Frontend: lista de categorias
- **`category.api.ts`:** tipos `CatalogCategory` (o nome evita colisão com `Category` da vitrine; inclui `childrenCount`), `CatalogCategoryNode` (`children`), `CategoryPage`, `CategoryTreePage`, `CategoryInput`, `CategoryFilter` (`page`, `pageSize`, `search`, `isActive`, `maxLevel`, `excludeSubtreeOf`). Funções `listCategories(token, filter)`, `listCategoryTree(token, { page, pageSize, expanded })`, `listCategoryChildren(token, id)`, `getCategory`, `createCategory`, `updateCategory`, `deleteCategory`.
- **Rotas com a query da lista:** `catalogCategoriesRoute(query?)`, `catalogCategoryNewRoute(query?)`, `catalogSubcategoryNewRoute(parentId, query?)` e `catalogCategoryRoute(id, query?)` em `catalog-routes.ts`, como as de marcas; as páginas `new` e `[id]` convertem `searchParams` em `returnQuery`; a página da lista fica em `<Suspense>`.
- **`use-categories.hook.ts`:** `page`/`search` na URL (debounce de 300 ms, página 1 omitida, busca volta à página 1, página fora do intervalo vai para a última); `mode = search ? 'search' : 'tree'`; preferência `expanded` lida e gravada em `localStorage['jaja:categories:tree-expanded']` com `try/catch` (padrão `false`). Modo árvore chama `listCategoryTree` com a preferência; modo busca chama `listCategories` com 20 por página. Estado por nó: `collapsedIds` (árvore expandida: começa vazio) ou `expandedIds` + cache `childrenById` e `loadingIds` (árvore recolhida: `toggleNode` busca `listCategoryChildren` só na primeira abertura). `remove(id)`: `deleteCategory`, toast "Categoria excluída", página anterior se era o único item de uma página > 1, senão recarrega limpando o cache; erro → `toast.error(toErrorMessage(error))`. Retorna ainda `listQuery`, `total`, `totalPages`, `setPage`, `searchInput`/`setSearchInput`, `expanded`/`setExpanded`.
- **`category.util.ts`:** `flattenCategoryTree(nodes, { collapsedIds | expandedIds, childrenById, loadingIds })` gera as linhas visíveis, incluindo a linha "Carregando…" sob um nó em carregamento. `buildCategoryTree` e `getDescendantIds` saem (a árvore vem pronta da API e a exclusão da subárvore é filtrada na API).
- **Componentes:** `category-tree.component.tsx` (linhas, recuo por `level`, controles "Expandir/Recolher <nome>" com `aria-expanded`, "Nova subcategoria em <nome>", "Editar <nome>", "Excluir <nome>") e `category-search-list.component.tsx` (linhas planas com caminho). `categories.page.tsx` monta cabeçalho, campo de busca, botão "Expandir tudo"/"Recolher tudo" (oculto na busca), esqueleto, `EmptyListState`, `PaginationControls` (`totalLabel` "departamentos" ou "categorias") e `DeleteConfirmationDialog` com `confirmDisabled={target.childrenCount > 0}`.

### 12. Frontend: seletor e formulário
- **`use-category-options.hook.ts`:** mesmo algoritmo de `useBrandOptions` (debounce de 300 ms, 20 por página, páginas acumuladas por "Carregar mais", `loading` derivado), com parâmetros `maxLevel`, `excludeSubtreeOf`, `selectedId` e `selectedLabel`. Rótulo = `path`. Selecionada fora das páginas e sem `selectedLabel` → `getCategory` (falha → "Categoria indisponível"). Retorna `CategorySelectState` (`options`, `search`, `setSearch`, `loading`, `hasMore`, `loadMore`, `selectedOption`).
- **`use-category-form.hook.ts`:** seletor de pai com `useCategoryOptions({ maxLevel: 2, excludeSubtreeOf: id, selectedId: parentId })`; a opção "Sem categoria pai (raiz)" (valor `''`, `null` no envio) entra no topo quando `search` está vazio. `?parentId=`: `getCategory`; `404` ou `level === 3` → raiz. Na edição, carrega a categoria por id (falha → toast e `router.replace(listHref)`). `FIELD_BY_CODE` mapeia os códigos para `slug`/`parentId` com `setError` e foco no primeiro; o resto vai para `toast.error`. Sucesso: toast "Categoria criada"/"Categoria atualizada" e `router.push(listHref)`, com `listHref = catalogCategoriesRoute(returnQuery)`. O slug automático usa `slugTouched`, que começa `true` na edição.
- **`category-form.component.tsx`:** seções e textos da spec; o `Combobox` de pai recebe `onSearchChange`, `selectedOption`, `loading`, `hasMore` e `onLoadMore`.

### 13. Seletores de categoria de produtos migram para o seletor sob demanda
Com `GET /categories` paginado, `use-product-options.hook.ts` (lista completa) é removido. `use-products.hook.ts` usa `useCategoryOptions({ selectedId: categoryId || undefined })` e `products.page.tsx` passa as props de busca ao `Combobox` de categoria, com "Todas as categorias" no topo sem texto de busca. `use-product-form.hook.ts` usa `useCategoryOptions({ selectedId: categoryId, selectedLabel: product.categoryPath })`, e `product-form.component.tsx`/`product-form.page.tsx` recebem um `CategorySelectState` no lugar de `categoryOptions`; o carregamento do formulário deixa de esperar as opções. Alternativa rejeitada: manter um endpoint sem paginação só para produtos, que conservaria a carga completa que esta change elimina.

### 14. Preferência no localStorage, não na URL
A preferência é do administrador, não do link: guardá-la na URL faria um link compartilhado impor o modo a outra pessoa. `localStorage` é lido depois da montagem (evita divergência de hidratação) e toda leitura/escrita fica em `try/catch`; sem acesso, vale "recolhida". Recolhida é o padrão porque é o modo de menor custo.

### 15. Execução por subagentes sequenciais
As partes Negócio → Backend → Frontend rodam em subagentes separados, cada um com contexto limpo, nessa ordem, porque backend e frontend dependem do `dist` de `@jaja/catalog`. Todos leem `.claude/skills/skills-standards.md`; o de frontend lê também `apps/frontend/DESIGN.md`.

## Risks / Trade-offs

- [06/07 não aplicados] → a tarefa 1.1 verifica e interrompe.
- [Concorrência: dois salvamentos simultâneos podem, juntos, criar ciclo ou estourar a profundidade, pois não há garantia no banco] → aceitável para a área administrativa de baixa concorrência.
- [Slug de categoria excluída continua reservado, e o administrador vê `409` para um slug que não aparece na lista] → a mensagem é verdadeira; restauração fica para depois.
- [O seed faz upsert por slug e sobrescreve edições manuais de categorias do seed] → seed é só de desenvolvimento.
- [`children` de um nó não é paginado: "Escolar" traz ~126 grupos em uma chamada, e a árvore expandida de uma página com vários departamentos grandes traz algumas centenas de linhas] → limitado a uma página de raízes; paginar filhas fica para quando o volume exigir.
- [`childrenCount` por subconsulta correlata em cada linha] → coberta pelo índice em `parent_id`; trivial no volume atual.
- [Mudança do contrato de `GET /categories` quebra consumidores que esperam a lista completa] → todos os consumidores do frontend (lista de categorias, formulário, produtos) migram nesta change; o `.http` é atualizado.
- [Preferência no `localStorage` não acompanha o administrador entre navegadores] → aceitável; é conveniência de exibição.
- [Prompt 09 resolve a categoria do produto pelos **nomes** `department → group → subgroup`, mas 14 dos 22 nomes de departamento dos produtos não correspondem às 12 raízes] → o seed de produtos deve resolver pelo par grupo/subgrupo com a mesma regra de raiz dona.

## Migration Plan

1. Conferir 06 e 07.
2. Negócio: DTOs, queries e casos de uso de `@jaja/catalog`; `npm test` e `npm run build --workspace=@jaja/catalog`.
3. Backend: migration aditiva `catalog_category`, `prisma:generate`, adapter com SQL paginado e auxiliares de busca compartilhados, controller, seed (duas execuções) e `.http`.
4. Frontend: API, hooks, lista, formulário, seletores de produtos, rotas, menu e mensagens.

Rollback em desenvolvimento: remover `seedCatalogCategories` do `seedTasks`, reverter os arquivos e rodar `prisma migrate reset`, ou criar uma migration que remove `categories`.
