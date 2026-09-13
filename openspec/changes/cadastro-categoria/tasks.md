> Execução: os grupos 2 (Negócio), 3 (Backend) e 4 (Frontend) rodam em subagentes separados, cada um com contexto limpo e na ordem 2 → 3 → 4 (design §15). Cada subagente lê `.claude/skills/skills-standards.md`; o do frontend lê também `apps/frontend/DESIGN.md`.

## 1. Pré-requisitos

- [x] 1.1 Confirmar que as changes dos prompts 06 e 07 estão aplicadas. Com `ls` e `grep`, verificar:
  - existem `apps/backend/src/shared/decorators/admin-only.decorator.ts`, `modules/catalog/src/brand/`, `apps/backend/src/modules/catalog/brand.prisma.ts`, `brand.controller.ts` e `test/brand.integration.http`;
  - existem `apps/backend/prisma/seed/tasks/catalog-brands.seed.ts`, `apps/frontend/src/shared/util/api-client.util.ts` e `apps/frontend/src/modules/catalog/data/brand.api.ts`;
  - `app-modules.ts` tem o item `catalog-brands` na seção `catalog-registrations`, e `catalog-routes.ts` tem `CATALOG_BRANDS_ROUTE`;
  - `modules/catalog/src/catalog` não existe mais.

  Se algo faltar, interromper e aplicar 06/07 antes.

## 2. Negócio: `@jaja/catalog`

- [x] 2.1 Gerar o scaffold: `node .claude/skills/module-aggregate/scripts/create-aggregate.js --module catalog --aggregate category --mode example`. Apagar o use case e o teste de exemplo gerados, mantendo `src/category/{model,provider,dto}`, os `index.ts` e `test/mock/in-memory-category.repository.ts`, e exportar `./category` em `src/index.ts`. Verificar com `find modules/catalog/src/category modules/catalog/test -type f` e `npm run build --workspace=@jaja/catalog`.
- [x] 2.2 Implementar `src/category/errors.ts` e `src/category/model/category.entity.ts` (skill module-entity) conforme design §2: VOs com `Result.combine`, padrões, `Category.resolveSlug`, invariante `parentId !== id` → `CATEGORY_CYCLE`, `create`/`tryCreate` e getters. Criar `test/category/category.entity.test.ts` cobrindo: atributos válidos com padrões, nome curto, slug inválido, slug derivado ("Borrachas Técnicas" → `borrachas-tecnicas`), descrição com 501 caracteres, URL `ftp://x`, `order` negativo e `parentId` igual ao `id`. Verificar com `npm test --workspace=@jaja/catalog`.
- [x] 2.3 Criar `src/category/provider/category.repository.ts` (skill module-repository), estendendo `CrudRepository<Category>` com `findBySlug`, `findByParentId(parentId: string | null)` e `findAll`. Documentar em JSDoc que `findById` falha com `CATEGORY_NOT_FOUND`, que excluídas nunca são retornadas e que o slug de excluídas continua reservado. Ajustar o mock in-memory ao contrato: `delete` preenche `deletedAt` e todas as buscas ignoram excluídas. Verificar com `npm run build --workspace=@jaja/catalog` e pelos testes de 2.5/2.6, que usam o mock.
- [ ] 2.4 Criar os DTOs e as queries de leitura (skills module-dto e module-query-cqrs) e exportar nos `index.ts`:
  - `dto/category.dto.ts`: `CategoryDTO` (com `level`, `path` e `childrenCount`), `CategoryTreeNodeDTO` (`CategoryDTO` + `children`), `CategoryPageDTO` e `CategoryTreePageDTO` (`items`, `total`, `page`, `pageSize`, `totalPages`);
  - `dto/category-filters.dto.ts`: `CategoryFiltersDTO` (`page`, `pageSize`, `search?`, `isActive?`, `maxLevel?`, `excludeSubtreeOf?`) e `CategoryTreeFilterDTO` (`page`, `pageSize`, `expanded`);
  - `provider/find-categories.query.ts` (`FindCategoriesQuery.execute(filter): Result<CategoryPageDTO>`), `find-category-tree.query.ts` (`FindCategoryTreeQuery.execute(filter): Result<CategoryTreePageDTO>`), `find-category-children.query.ts` (`FindCategoryChildrenQuery.execute(parentId): Result<CategoryTreeNodeDTO[] | null>`) e `find-category-by-id.query.ts` (`FindCategoryByIdQuery.execute(id): Result<CategoryDTO | null>`), com JSDoc das regras de ordenação e filtros da spec.

  Verificar com `npm run build --workspace=@jaja/catalog` e que os tipos são importáveis a partir de `@jaja/catalog`.
- [x] 2.5 Implementar `src/category/use-case/save-category.use-case.ts` (skill module-use-case) com a ordem de verificações do design §3 e a semântica de alteração do §4, devolvendo `{ id }`. Criar `test/category/save-category.use-case.test.ts`, com o mock, cobrindo:
  - criação de raiz com padrões, de filha e de neta;
  - quarto nível (`CATEGORY_MAX_DEPTH_EXCEEDED`), pai inexistente (`PARENT_CATEGORY_NOT_FOUND`) e ids malformados (`INVALID_ID`);
  - slug duplicado em outro ramo (`CATEGORY_SLUG_ALREADY_EXISTS`) e alteração mantendo o próprio slug;
  - mover categoria com filhas para uma pai de nível 2 (`CATEGORY_MAX_DEPTH_EXCEEDED`);
  - pai igual a ela mesma e pai descendente (`CATEGORY_CYCLE`, também quando a profundidade estouraria);
  - campos omitidos mantidos, `null`/`''` limpando `parentId`/`description`/`imageUrl` e `null` mantendo `order`/`isHighlighted`/`isActive`;
  - `id` inexistente criando com o id informado.

  Verificar com `npm test --workspace=@jaja/catalog`.
- [x] 2.6 Implementar `src/category/use-case/delete-category.use-case.ts`: `findById` (falha `CATEGORY_NOT_FOUND`), depois `findByParentId` (não vazio → `CATEGORY_HAS_CHILDREN`), depois `delete`. Criar `test/category/delete-category.use-case.test.ts` cobrindo: exclusão de folha (some de `findAll`), exclusão de categoria com filhas rejeitada sem excluir nada e id inexistente. Verificar com `npm test --workspace=@jaja/catalog`.
- [ ] 2.7 Rodar `npm test --workspace=@jaja/catalog` e `npm run build --workspace=@jaja/catalog`. Verificar que todos os testes passam (inclusive `brand`, `product` e `test/index.test.ts`) e que `modules/catalog/dist/category/` contém os novos DTOs e queries.

## 3. Backend: `@jaja/backend`

- [x] 3.1 Adicionar o model `Category` em `apps/backend/prisma/models/catalog.model.prisma` conforme design §9 (skill backend-prisma-data). Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_category` e `npm run prisma:generate --workspace=@jaja/backend`. Verificar que a migration gerada só cria a tabela `categories`, com índice único em `slug`, índice em `parent_id` e FK `parent_id → categories(id)` com `ON DELETE RESTRICT`.
- [ ] 3.2 Extrair `folded`, `toPrefixTsQuery` e o limite de termos de `brand.prisma.ts` para `apps/backend/src/modules/catalog/text-search.sql.ts` (exportados) e fazer `BrandPrisma` usá-los. Verificar com `npm run build --workspace=@jaja/backend` e, com o backend no ar, que `GET /brands?search=spir` e `GET /brands?page=2` respondem como antes (mesmos itens e totais).
- [ ] 3.3 Implementar `apps/backend/src/modules/catalog/category.prisma.ts` (`CategoryPrisma`) conforme design §6 e §7:
  - repositório com o client Prisma (`deletedAt: null`, `delete` lógico, tradução de `P2002`/`P2003`/`P2025`);
  - seleção base em SQL com `level`, `path` e `childrenCount`;
  - atributos públicos `findCategories`, `findCategoryTree`, `findCategoryChildren` e `findCategoryById`, paginados e ordenados como na spec, com a busca de `text-search.sql.ts`.

  Registrar em `providers` e `exports` de `catalog.module.ts`. Verificar com `npm run build --workspace=@jaja/backend`.
- [ ] 3.4 Implementar `apps/backend/src/modules/catalog/category.controller.ts` (skill backend-controller) com `@AdminOnly()`, as rotas `GET /`, `GET /tree`, `GET /:id/children`, `GET /:id`, `POST /`, `PUT /:id` e `DELETE /:id` (com `tree` antes de `:id`), a validação de parâmetros e o mapeamento de falhas do design §10; `POST`/`PUT` respondem com `findCategoryById` após salvar. Verificar com `npm run build --workspace=@jaja/backend` e, com o backend no ar (porta 4000), que `GET /categories/tree` sem token responde `401`.
- [x] 3.5 Criar `apps/backend/prisma/seed/tasks/catalog-categories.seed.ts` (`seedCatalogCategories`) com o algoritmo de duas fases do design §8 e registrá-lo em `prisma/seed/main.ts` após `seedCatalogBrands`. Rodar `npm run prisma:seed --workspace=@jaja/backend` duas vezes. Verificar por SQL no Postgres (porta 5433) que:
  - há 1.111 categorias, das quais 12 raízes, 708 de nível 2 e 391 de nível 3, e nenhuma de nível 4;
  - total e ids não mudam entre as duas execuções;
  - existem `papel-sulfite-chamequinho`, `livros` (sob "Escolar") e `escritorio-livros`;
  - "Borrachas Técnicas" está sob "Escolar / Borrachas" e "Tesouras" sob "Artes & Pintura";
  - `git status apps/cli/data` não mostra alterações.
- [ ] 3.6 Atualizar `apps/backend/src/modules/catalog/test/category.integration.http`, obtendo os tokens como em `brand.integration.http` e usando slugs com `{{$timestamp}}`. Cobrir, em sequência:
  - sem token (401) e usuário não administrador (403);
  - criação de raiz, filha e neta (201, conferindo `level`, `path` e `childrenCount`) e dados inválidos (400);
  - quarto nível (400), pai inexistente (404), pai malformada (400 `INVALID_ID`), slug duplicado (409) e ciclo (400);
  - `GET /categories` sem filtros (página com `total`/`totalPages`), com `pageSize=500` (limitado a 100), com `search`, com `isActive=true` e com `maxLevel=2&excludeSubtreeOf=<raiz criada>` (200);
  - `GET /categories/tree` recolhida e com `expanded=true&pageSize=5` (200), `GET /categories/<raiz>/children` (200) e de um uuid inexistente (404);
  - busca por id (200 e 404), alteração (200) e `PUT` de categoria excluída (404);
  - exclusão de categoria com filhas (409) e de folha (204, seguida de 404 e do `childrenCount` da pai reduzido).

  Com o backend no ar, executar todas as chamadas, verificar os status esperados e excluir as categorias de teste restantes (neta → filha → raiz).
- [ ] 3.7 Rodar `npm run test --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend`. Verificar zero falhas e que `POST /auth/login`, `GET /brands` e `GET /products?categoryId=<id>` continuam respondendo como antes.

## 4. Frontend: `@jaja/frontend`

- [x] 4.1 Adicionar `PARENT_CATEGORY_NOT_FOUND`, `CATEGORY_SLUG_ALREADY_EXISTS`, `CATEGORY_MAX_DEPTH_EXCEEDED`, `CATEGORY_CYCLE` e `CATEGORY_HAS_CHILDREN` em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, reaproveitando `CATEGORY_NOT_FOUND`, que já existe. Verificar com `grep` que os seis códigos aparecem nos dois arquivos.
- [ ] 4.2 Atualizar a camada de dados em `apps/frontend/src/modules/catalog/data/` (e `data/index.ts`) conforme design §11 e §12:
  - `category.api.ts`: tipos `CatalogCategory` (com `childrenCount`), `CatalogCategoryNode`, `CategoryPage`, `CategoryTreePage`, `CategoryInput` e `CategoryFilter`; funções `listCategories`, `listCategoryTree`, `listCategoryChildren`, `getCategory`, `createCategory`, `updateCategory` e `deleteCategory`;
  - `category.schema.ts` (skill frontend-form-schema): `Id` opcional para `parentId`, `Name`, `Alias`, `Text` opcional até 500, `Order`, `Flag` e `Url` opcional, com tipo `CategoryFormData`;
  - `category.util.ts`: `flattenCategoryTree` para as linhas visíveis (com a linha "Carregando…"), sem `buildCategoryTree` e `getDescendantIds`;
  - `use-category-options.hook.ts`: seletor com busca na API, 20 por vez, "Carregar mais", `maxLevel`, `excludeSubtreeOf`, `selectedId` e `selectedLabel`.

  Verificar com `npm run lint --workspace=@jaja/frontend`.
- [ ] 4.3 Atualizar as rotas: `catalogCategoriesRoute(query?)`, `catalogCategoryNewRoute(query?)`, `catalogSubcategoryNewRoute(parentId, query?)` e `catalogCategoryRoute(id, query?)` em `src/shared/navigation/catalog-routes.ts`; `src/app/admin/(shell)/catalog/categories/page.tsx` com `<Suspense>`, `new/page.tsx` (aguarda `searchParams`, repassa `parentId` e `returnQuery`) e `[id]/page.tsx` (aguarda `params` e `searchParams`, repassa `id` e `returnQuery`); manter o item "Categorias" (`catalog-categories`, `FolderTree`, `match: 'prefix'`) após "Marcas" em `app-modules.ts`. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [ ] 4.4 Implementar `use-categories.hook.ts` conforme design §11: `page`/`search` na URL com debounce de 300 ms, preferência `jaja:categories:tree-expanded` no `localStorage` (recolhida por padrão, leitura após montar e com `try/catch`), modo árvore (`listCategoryTree`) ou busca (`listCategories`), filhas sob demanda com cache por nó, recolher local na árvore expandida, `remove` com volta à página anterior e `listQuery`. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [ ] 4.5 Implementar `components/category-tree.component.tsx`, `components/category-search-list.component.tsx` e `pages/categories.page.tsx`:
  - cabeçalho "Categorias" com "<n> departamento(s) no catálogo" ou "<n> categoria(s) encontrada(s)", campo de busca, "Nova categoria" e o botão "Expandir tudo"/"Recolher tudo" (oculto na busca);
  - árvore com recuo por `level`, controles "Expandir/Recolher <nome>", "Carregando…" sob o nó, selo "Destaque", status "Ativa"/"Inativa" e ações com a query da lista ("Nova subcategoria" só nos níveis 1 e 2);
  - lista de busca com caminho, slug, ordem, status e as mesmas ações;
  - esqueleto estático, `EmptyListState` ("Nenhuma categoria cadastrada"/"Nenhuma categoria encontrada"), `PaginationControls` e `DeleteConfirmationDialog` com `confirmDisabled` por `childrenCount`.

  Verificar com `npm run lint --workspace=@jaja/frontend`.
- [ ] 4.6 Atualizar `use-category-form.hook.ts`, `components/category-form.component.tsx` e `pages/category-form.page.tsx` conforme design §12: seletor de pai com `useCategoryOptions({ maxLevel: 2, excludeSubtreeOf })` e a opção raiz no topo sem busca, `?parentId=` validado por `getCategory` (404 ou nível 3 → raiz), `listHref` com `returnQuery` no sucesso, em Cancelar, em "← Voltar para categorias" e na falha ao carregar, mapeamento de códigos para `slug`/`parentId` e textos da spec. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [ ] 4.7 Migrar os seletores de categoria de produtos (design §13): remover `data/use-product-options.hook.ts`; `use-products.hook.ts` e `pages/products.page.tsx` com `useCategoryOptions({ selectedId })` e "Todas as categorias" no topo sem busca; `use-product-form.hook.ts`, `components/product-form.component.tsx` e `pages/product-form.page.tsx` com `useCategoryOptions({ selectedId, selectedLabel: categoryPath })` e `CategorySelectState` no lugar de `categoryOptions`. Verificar com `grep -rn "useProductOptions\|categoryOptions" apps/frontend/src` sem resultados e `npm run lint --workspace=@jaja/frontend`.
- [ ] 4.8 Rodar `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend`. Verificar zero erros e que `/admin/catalog/categories`, `/admin/catalog/categories/new`, `/admin/catalog/categories/[id]` e as rotas de produtos aparecem na saída do build.

## 5. Validação ponta a ponta

- [ ] 5.1 Com banco, backend e frontend no ar e o painel do navegador **visível**, entrar em `/admin/login` como `usuario@formacao.dev` e verificar:
  - menu com "Visão geral", "Marcas" e "Categorias", sem o rótulo "Cadastros", e "Categorias" ativo;
  - primeira visita: "12 departamentos no catálogo", árvore recolhida, botão "Expandir tudo" e, nas requisições, só `GET /categories/tree`;
  - expandir "Escolar" dispara `GET /categories/<id>/children` uma única vez, mostra os grupos e, recolhido e reaberto, não busca de novo;
  - "Expandir tudo" e recarregar mantém a árvore expandida (preferência no localStorage); "Recolher tudo" volta ao modo recolhido;
  - busca "borracha tecn" mostra a lista plana com o caminho, com `search` na URL; limpar a busca volta à árvore;
  - "Nova subcategoria" num grupo abre o formulário com a pai pré-selecionada e slug automático; salvar volta à lista com a mesma busca/página e toast;
  - seletor de pai busca na API, mostra "Carregar mais" e, na edição de "Escolar", não oferece "Escolar" nem suas descendentes;
  - edição movendo um subgrupo para outro grupo; mover um departamento com filhas para um grupo mostra o erro de profundidade no campo pai; slug duplicado aparece no campo slug;
  - exclusão bloqueada no diálogo para categoria com filhas e exclusão de folha com toast;
  - na listagem de produtos, o filtro de categoria busca na API e `?categoryId=` exibe o caminho; no formulário de produto, a categoria atual aparece pelo caminho e a busca funciona.
