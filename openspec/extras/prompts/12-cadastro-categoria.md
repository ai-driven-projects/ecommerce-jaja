# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/catalog` (`@jaja/catalog`), que já possui o agregado `brand` (prompt 11) e o padrão de repositório/queries/casos de uso a seguir. Shared: `@mentoria-360/shared`. Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- VOs disponíveis no shared: `Id`, `Name` (2–100), `Alias` (slug; `Alias.format(texto)` gera slug), `Text` (`minLength`/`maxLength`), `Url`, `Flag`, `Order` (inteiro ≥ 0).
- Backend é ESM (imports com `.js`). `@jaja/catalog` é consumido via `dist`: rodar `npm run build --workspace=@jaja/catalog` antes de usar no backend. Endpoints administrativos usam `@AdminOnly()` (prompt 10). Frontend: área administrativa em `/admin`, módulo `apps/frontend/src/modules/catalog` com `data/` flat, páginas em `pages/` e componentes em `components/`; seção "Cadastros" do menu do módulo Catálogo em `src/shared/navigation/app-modules.ts` já contém "Marcas".
- **Dados de referência:** `apps/cli/data/kalunga/index.json` e `apps/cli/data/kalunga/categories/<slug>.json` (12 departamentos raspados da Kalunga). Cada arquivo traz em `category` o departamento (`id`, `slug`, `name`, `shortName`, `order`) e em `category.groups` os grupos (`id`, `departmentId`, `departmentSlug`, `slug`, `name`, `highlighted`). Atenção: a lista `groups` inclui grupos de **outros** departamentos (`departmentId` diferente de `category.id`); só os grupos do próprio departamento fazem parte dele. Cada produto em `products[]` traz `category: { department, group, subgroup, path }`, ou seja, a hierarquia tem **três níveis**: departamento → grupo → subgrupo. Quando `subgroup` é igual a `group` (ex.: `Escolar/Borrachas/Borrachas`), não existe terceiro nível. Não editar esses arquivos.

# Negócio

- Criar o agregado de `category` (skill: module-aggregate, `--mode example`, apagando o use case e o teste gerados e mantendo `model/`, `provider/`, `dto/` e o mock `test/mock/in-memory-category.repository.ts`).
- Alterar a entidade `category` para possuir os seguintes atributos:
  - `id` — identificador único (`Id`)
  - `name` — nome da categoria (obrigatório, `Name`)
  - `slug` — identificador de URL (obrigatório, `Alias`); **único em todo o catálogo** (facilita rotas públicas futuras `/c/[slug]`); derivado do nome com `Alias.format` quando não informado
  - `description` — descrição (opcional, `Text` até 500 caracteres)
  - `parentId` — id da categoria pai (opcional, `Id`); `null` para categoria raiz (departamento)
  - `order` — ordem de exibição entre irmãs (`Order`, padrão `0`)
  - `isHighlighted` — categoria em destaque no menu/vitrine; padrão `false` (`Flag`)
  - `imageUrl` — URL da imagem ilustrativa (opcional, `Url`)
  - `isActive` — indica se a categoria está ativa; padrão `true` (`Flag`)

  Invariante da entidade: `parentId` não pode ser igual ao próprio `id`. As demais regras de hierarquia dependem do repositório e ficam nos casos de uso. Validar com `Result.combine`, expor `create`/`tryCreate` e getters. (skill: module-entity)

- Criar a interface `category.repository` estendendo `CrudRepository<Category>` e adicionando `findBySlug(slug: string): Promise<Result<Category | null>>`, `findByParentId(parentId: string | null): Promise<Result<Category[]>>` (filhas diretas) e `findAll(): Promise<Result<Category[]>>`. Registros com `deletedAt` nunca são retornados. (skill: module-repository)

- Criar os DTOs em `modules/catalog/src/category/dto/category.dto.ts`: `CategoryDTO` (`id`, `name`, `slug`, `description`, `parentId`, `order`, `isHighlighted`, `imageUrl`, `isActive`, `level` (1 a 3), `path` (nomes dos ancestrais e o próprio, separados por " / ", ex.: `Escolar / Borrachas / Borrachas Técnicas`), `createdAt`, `updatedAt`). (skill: module-dto)

- Criar as interfaces de query em `modules/catalog/src/category/provider/`: `find-categories.query.ts` (`FindCategoriesQuery`, contrato `execute(filter: { isActive?: boolean }): Promise<Result<CategoryDTO[]>>`, lista **plana** de todas as categorias com `level` e `path` calculados, ordenada por `path`; a árvore é montada pelo consumidor) e `find-category-by-id.query.ts` (`FindCategoryByIdQuery`, `execute(id: string): Promise<Result<CategoryDTO | null>>`). (skill: module-query-cqrs)

- Criar o caso de uso `save-category.use-case` em `modules/catalog/src/category/use-case` que recebe por parâmetro o repositório `category`. Entrada: `{ id?, name, slug?, description?, parentId?, order?, isHighlighted?, imageUrl?, isActive? }`. Fluxo comum a criação e alteração: se houver `parentId`, a categoria pai deve existir (falha `PARENT_CATEGORY_NOT_FOUND`); derivar o slug quando ausente e verificar unicidade global (falha `CATEGORY_SLUG_ALREADY_EXISTS`, ignorando a própria categoria na alteração); calcular a profundidade da pai subindo pela cadeia de `parentId` — a profundidade resultante da categoria salva **e da sua subárvore** não pode passar de 3 (falha `CATEGORY_MAX_DEPTH_EXCEEDED`). Na alteração, a nova pai não pode ser a própria categoria nem uma descendente dela (falha `CATEGORY_CYCLE`). Criação quando não houver `id` ou não existir (gerar uuid v4; `isActive = true`, `order = 0`, `isHighlighted = false` por padrão); alteração quando existir (aplicar via `cloneWith`). (skill: module-use-case)

- Criar o caso de uso `delete-category.use-case` em `modules/catalog/src/category/use-case` que recebe por parâmetro o repositório `category`. Fluxo: buscar por id (falha `CATEGORY_NOT_FOUND`), verificar que não possui filhas (falha `CATEGORY_HAS_CHILDREN`) e deletar via soft delete. A regra "categoria com produtos não pode ser excluída" será adicionada no prompt 13. (skill: module-use-case)

- Criar testes unitários (jest, em `modules/catalog/test/**`) para a entidade `category` e para os dois casos de uso cobrindo: criação de raiz, de filha e de neta; quarto nível rejeitado; pai inexistente; slug duplicado; mover categoria com filhas para um nível que estoure a profundidade; ciclo (pai = descendente); exclusão de folha; exclusão de categoria com filhas rejeitada. Rodar `npm test --workspace=@jaja/catalog`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- Mapear a entidade `category` em `apps/backend/prisma/models/catalog.model.prisma` (model `Category`, tabela `categories`, `slug` único, auto-relação `parent`/`children` por `parentId` opcional com `onDelete: Restrict`, índice em `parentId`, `deletedAt` opcional). (skill: backend-prisma-data)
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_category` e `npm run prisma:generate --workspace=@jaja/backend`.
- Criar `apps/backend/src/modules/catalog/category.prisma.ts` (`CategoryPrisma`) no mesmo padrão de `BrandPrisma` (soft delete, `deletedAt: null` nas buscas), com as queries `findCategories: FindCategoriesQuery` (carrega todas as categorias em uma consulta e calcula `level` e `path` em memória) e `findCategoryById: FindCategoryByIdQuery` como atributos públicos. Registrar em `catalog.module.ts`.
- Criar o `category.controller` em `apps/backend/src/modules/catalog/category.controller.ts`, `@AdminOnly()` na classe: (skill: backend-controller)
  - `POST /categories` — criar, instanciando `save-category.use-case` sem `id`; `201` com o `CategoryDTO`
  - `GET /categories` — lista plana com `?isActive=`, chamando `FindCategoriesQuery` diretamente
  - `GET /categories/:id` — `FindCategoryByIdQuery` diretamente; `404` quando `null`
  - `PUT /categories/:id` — atualizar, instanciando `save-category.use-case` com `id`
  - `DELETE /categories/:id` — exclusão lógica via `delete-category.use-case`; `204`

  Mapeamento de falhas: `CATEGORY_NOT_FOUND` e `PARENT_CATEGORY_NOT_FOUND` → `NotFoundException`; `CATEGORY_SLUG_ALREADY_EXISTS` e `CATEGORY_HAS_CHILDREN` → `ConflictException`; `CATEGORY_MAX_DEPTH_EXCEEDED`, `CATEGORY_CYCLE` e demais falhas → `BadRequestException` com os códigos.

- Criar a task de seed `apps/backend/prisma/seed/tasks/catalog-categories.seed.ts` que lê `apps/cli/data/kalunga/index.json` e cada `categories/<file>` (mesma estratégia de caminho do seed de marcas) e monta os três níveis:
  1. **Raiz** a partir de `category` de cada arquivo: `name`, `slug`, `order` (campo `order` do departamento), `parentId: null`.
  2. **Grupos** a partir de `category.groups` filtrando `departmentId === category.id`: `name`, `slug` do grupo, `isHighlighted: highlighted`, `order` = posição na lista, `parentId` = raiz.
  3. **Subgrupos** a partir de `products[].category` de cada arquivo, quando `subgroup !== group`: `name = subgroup`, `slug = Alias.format(subgroup)`, `parentId` = grupo de mesmo nome dentro da raiz (se o grupo não existir na lista filtrada, criá-lo também), `order` alfabética.

  Como o slug é único globalmente, ao colidir com um slug já usado por outra categoria, prefixar com o slug da pai (`<slug-pai>-<slug>`). Fazer `upsert` por `slug`, com `id` uuid v4 na inserção, `description: null`, `imageUrl: null`, `isActive: true`. Registrar no `seedTasks` após o seed de marcas.
- Executar `npm run prisma:seed --workspace=@jaja/backend` e conferir que há 12 categorias raiz e nenhuma categoria com profundidade maior que 3.
- Criar os testes de integração Rest Client em `apps/backend/src/modules/catalog/test/category.integration.http` cobrindo: 401, 403, criação de raiz (201), de filha (201) e de neta (201), quarto nível (400), pai inexistente (404), slug duplicado (409), ciclo (400), listagem plana com `level`/`path` (200), alteração (200), exclusão de categoria com filhas (409) e de folha (204). Subir o backend e validar as chamadas.

# Frontend

- Criar em `apps/frontend/src/modules/catalog/data/` (atualizar `data/index.ts`):
  - `category.api.ts` — `listCategories`, `getCategory`, `createCategory`, `updateCategory`, `deleteCategory` (mesmo padrão de `brand.api.ts`)
  - `category.schema.ts` — schema com `v` usando `Name`, `Alias`, `Url` (opcional), `Order`, `parentId` opcional, `description` opcional até 500; tipo `CategoryFormData` (skill: frontend-form-schema)
  - `category.util.ts` — `buildCategoryTree(categories)` (lista plana → árvore ordenada por `order` e nome) e `getDescendantIds(categories, id)`
  - `use-categories.hook.ts` — lista plana + árvore derivada, estado de carregamento, ação de excluir
  - `use-category-form.hook.ts` — carrega a categoria no modo edição, monta as opções de pai (categorias com `level <= 2`, excluindo a própria e suas descendentes, rotuladas pelo `path`), submete e mapeia `409`/`400` para erros de campo (`slug`, `parentId`)
- Criar a página `categories.page.tsx` em `modules/catalog/pages` (rota `/admin/catalog/categories`) que exibe a hierarquia como **árvore** em tabela: uma linha por categoria com recuo proporcional ao `level`, botão de recolher/expandir por nó (estado local, todos expandidos por padrão), nome, slug, ordem, badge "Destaque" quando `isHighlighted`, status e ações de editar/excluir (`DeleteConfirmationDialog`; quando a categoria tem filhas, desabilitar a confirmação com `confirmDisabledMessage`). Botão "Nova categoria" no cabeçalho. Componente `category-tree.component.tsx` em `modules/catalog/components` renderiza a árvore recebida como prop.
- Criar `category-form.component.tsx` em `modules/catalog/components` usando `form-section-layout` (sem modal), com `react-hook-form` + `v.resolver`. Campos: `parentId` (`Combobox` com as opções de pai e a opção "Sem categoria pai (raiz)"), `name`, `slug` (automático a partir do nome até edição manual), `description`, `order` (numérico), `isHighlighted` (`Checkbox`), `imageUrl` (com pré-visualização) e `isActive` (apenas na edição). Página `category-form.page.tsx` para `/admin/catalog/categories/new` e `/admin/catalog/categories/[id]`; a rota de criação aceita `?parentId=` para pré-selecionar a pai (a lista oferece a ação "Nova subcategoria" nas linhas de nível 1 e 2).
- Criar as rotas em `apps/frontend/src/app/admin/catalog/categories/page.tsx`, `categories/new/page.tsx` e `categories/[id]/page.tsx`, as constantes `CATALOG_CATEGORIES_ROUTE` e `catalogCategoryRoute(id)` em `catalog-routes.ts`, e atualizar `modules/catalog/index.ts`.
- Adicionar o item **"Categorias"** (ícone `FolderTree` do `lucide-react`, `match: 'prefix'`) na seção "Cadastros" do módulo Catálogo, após "Marcas".
- Em caso de sucesso em qualquer operação (criar, editar, excluir), exibir toaster de sucesso, voltar para a lista e atualizar a árvore.
- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros; conferir no navegador a árvore com os 12 departamentos do seed, criação de subcategoria a partir da lista, edição movendo uma categoria de pai e exclusão bloqueada para categoria com filhas.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (Backend e Frontend dependem do build de `@jaja/catalog`). Cada subagente deve ler `.claude/skills/skills-standards.md`; o do frontend deve ler também `apps/frontend/DESIGN.md`.
