## Why

O cadastro de produtos exige que todo produto pertença a uma categoria, e a loja de referência (Kalunga) organiza o sortimento em três níveis: departamento, grupo e subgrupo. Precisamos de categorias hierárquicas com regras de integridade (sem ciclos, no máximo três níveis, slug único para as futuras rotas públicas `/c/[slug]`), de uma tela administrativa para mantê-las e de uma carga inicial com a árvore real dos dados raspados. Com mais de mil categorias, nem a tela nem os seletores podem carregar tudo de uma vez: a lista precisa de paginação, busca e carregamento das filhas sob demanda, e os seletores precisam buscar na API, como já acontece com marcas.

## What Changes

- **Pré-requisito**: esta change parte do estado deixado pelos prompts 06 (`@AdminOnly()` e sub-itens do módulo Catálogo no menu) e 07 (agregado `brand`, `BrandPrisma` com busca textual e paginação, seed de marcas, `api-client.util.ts`, `brand.api.ts` e `useBrandOptions`). Eles MUST estar aplicados antes; esta change não os reimplementa.
- **Domínio (`@jaja/catalog`)**:
  - Agregado `category` com `id`, `name`, `slug`, `description`, `parentId`, `order`, `isHighlighted`, `imageUrl` e `isActive`; a entidade impede que uma categoria seja pai de si mesma.
  - Repositório com `findBySlug`, `findByParentId` e `findAll`.
  - DTOs `CategoryDTO` (com `level`, `path` e `childrenCount`), `CategoryTreeNodeDTO` e as páginas `CategoryPageDTO`/`CategoryTreePageDTO`.
  - Queries `FindCategoriesQuery` (lista plana paginada com busca e filtros), `FindCategoryTreeQuery` (departamentos paginados, recolhidos ou com a árvore completa), `FindCategoryChildrenQuery` (filhas diretas) e `FindCategoryByIdQuery`.
  - Casos de uso `SaveCategory` (cria ou altera validando pai existente, slug único global, profundidade máxima 3 incluindo a subárvore e ausência de ciclo) e `DeleteCategory` (exclusão lógica, bloqueada quando há filhas); mock in-memory e testes jest.
- **Backend (`@jaja/backend`)**:
  - Model Prisma `Category` com auto-relação `parent`/`children` (`onDelete: Restrict`) e migration `catalog_category`.
  - `CategoryPrisma`: repositório e queries em SQL paginado, com `level`, `path` e `childrenCount` calculados na própria consulta e a mesma busca textual das marcas (auxiliares compartilhados com `BrandPrisma`).
  - `CategoryController` com `@AdminOnly()`: `GET /categories` (lista plana paginada), `GET /categories/tree` (árvore paginada), `GET /categories/:id/children`, `GET /categories/:id`, `POST`, `PUT /:id` e `DELETE /:id`.
  - Seed `seedCatalogCategories` a partir de `apps/cli/data/kalunga`, idempotente: 12 departamentos, 708 grupos e 391 subgrupos.
  - Testes de integração Rest Client.
- **Frontend (`@jaja/frontend`)**:
  - `/admin/catalog/categories`: árvore paginada por departamento (20 por página), botão "Expandir tudo"/"Recolher tudo" com a preferência guardada no localStorage (recolhida por padrão; recolhida só busca os departamentos da página e carrega as filhas de um nó quando ele é aberto), busca que troca a árvore por uma lista plana paginada com o caminho, `page` e `search` na URL, ações de editar, excluir (bloqueada para categorias com filhas) e "Nova subcategoria".
  - `/admin/catalog/categories/new` (aceita `?parentId=`) e `/admin/catalog/categories/[id]`: formulário em página com slug automático e seletor de categoria pai que busca na API, 20 por vez, com "Carregar mais", sem oferecer a própria categoria nem sua subárvore.
  - Os seletores de categoria da listagem e do formulário de produtos passam a usar o mesmo seletor sob demanda, no lugar da lista completa.
  - Criar, editar ou cancelar a partir da lista volta para a mesma página e busca.
  - O menu do Catálogo ganha o sub-item "Categorias" após "Marcas"; as mensagens dos códigos de erro de categoria existem em pt/en.
- **Decisões tomadas com o usuário**:
  - No seed, o subgrupo citado por um produto fica no grupo de mesmo nome da raiz que **possui** esse grupo; só os 27 grupos que nenhuma raiz possui são criados sob a raiz do arquivo.
  - A árvore é paginada por departamento; a preferência recolhida/expandida é global e, recolhida, as filhas vêm sob demanda; a busca mostra uma lista plana com o caminho; os seletores de categoria de produtos migram nesta change.

## Capabilities

### New Capabilities

- `catalog/category-management`: regras de negócio e contrato HTTP das categorias. Cobre atributos e validações, hierarquia de até três níveis, ausência de ciclos, slug único global, criação/alteração, lista plana paginada com busca e filtros, árvore paginada, filhas diretas, consulta por id, exclusão lógica bloqueada por filhas, formato dos erros, acesso restrito a administradores e a carga inicial a partir dos dados da Kalunga.
- `admin/catalog-categories`: telas administrativas de categorias. Cobre o item de menu, a árvore paginada com preferência recolhida/expandida, a busca na lista, o formulário de criação/edição (inclusive subcategoria a partir da lista), o seletor de categoria com busca na API (também usado nas telas de produtos), o mapeamento dos erros da API para os campos, a exclusão com bloqueio para categorias com filhas e o retorno à lista.

### Modified Capabilities

Nenhuma. O item de menu, as rotas e os seletores de categoria ficam descritos em `admin/catalog-categories`. A regra "categoria com produtos não pode ser excluída" pertence aos deltas da change `cadastro-produto` sobre as mesmas capabilities.

## Impact

- `modules/catalog`: `src/category/{model,provider,dto,use-case}`, `errors.ts`, `test/category/*` e `test/mock/in-memory-category.repository.ts`; exportações em `src/index.ts`. Backend e frontend dependem de `npm run build --workspace=@jaja/catalog`.
- `apps/backend`:
  - `prisma/models/catalog.model.prisma` (model `Category`) e migration `catalog_category`.
  - `src/modules/catalog/category.prisma.ts`, `category.controller.ts`, `catalog.module.ts`, `test/category.integration.http` e o novo `text-search.sql.ts`, com os auxiliares de busca extraídos de `brand.prisma.ts`.
  - `prisma/seed/tasks/catalog-categories.seed.ts` e `prisma/seed/main.ts`.
- `apps/frontend`:
  - `src/modules/catalog/data/{category.api,category.schema,category.util,use-categories.hook,use-category-options.hook,use-category-form.hook}.ts` e `data/index.ts`.
  - `components/{category-tree,category-search-list,category-form}.component.tsx`, `pages/{categories,category-form}.page.tsx` e `modules/catalog/index.ts`.
  - `src/app/admin/(shell)/catalog/categories/{page,new/page,[id]/page}.tsx`.
  - `src/shared/navigation/catalog-routes.ts`, `src/shared/navigation/app-modules.ts`, `src/shared/i18n/messages.{pt,en}.ts` e `src/shared/components/ui/combobox.tsx`.
  - Produtos: remoção de `data/use-product-options.hook.ts` e ajustes em `use-products.hook.ts`, `use-product-form.hook.ts`, `pages/products.page.tsx`, `pages/product-form.page.tsx` e `components/product-form.component.tsx`.
- API: `GET /categories` devolve uma página (`{ items, total, page, pageSize, totalPages }`), não mais a lista completa; todo consumidor do frontend é migrado nesta change.
- Dados: `apps/cli/data/kalunga/**` são apenas lidos, nunca editados.
- Fora de escopo:
  - Rota pública `/c/[slug]` e uso das categorias na vitrine.
  - Regra "categoria com produtos não pode ser excluída" (change `cadastro-produto`).
  - Reordenação por arrastar e upload de imagem (só URL).
  - Paginação das filhas diretas de um nó (vêm todas em uma chamada) e filtro de status na tela de categorias.
  - Mudanças em `packages/shared`.
