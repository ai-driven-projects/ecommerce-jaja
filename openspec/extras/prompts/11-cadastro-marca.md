# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/catalog` (`@jaja/catalog`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md` (pastas `model/`, `provider/`, `use-case/`, `dto/`; sufixos `.entity.ts`, `.repository.ts`, `.query.ts`, `.use-case.ts`, `.vo.ts`).
- VOs disponíveis no shared: `Id`, `Name` (2–100 caracteres), `Alias` (slug `^[a-z0-9]+(?:-[a-z0-9]+)*$`, com `Alias.format(texto)` para gerar slug a partir de um nome), `Text` (com `minLength`/`maxLength`), `Url` (apenas http/https), `Flag` (booleano). Entidades estendem `Entity` do shared, que já fornece `id`, `createdAt`, `updatedAt` e `deletedAt`. Validação com `Result.combine`, expondo `create`/`tryCreate` e getters.
- `modules/catalog` hoje contém apenas o scaffold placeholder `src/catalog` (entidade `Catalog`, `CreateCatalog`, `CatalogDTO`, repositório, mock in-memory e teste). Ele deve ser removido nesta funcionalidade, mantendo `getModuleName()` e seu teste em `test/index.test.ts`.
- Backend é ESM (`"type": "module"`): imports relativos com sufixo `.js`. `@jaja/catalog` é consumido via `dist`: rodar `npm run build --workspace=@jaja/catalog` antes de usar no backend.
- Área administrativa (`/admin` no frontend, `@AdminOnly()` + `AdminGuard` no backend) já criada pelo prompt 10. Autenticação (JWT, `useAuth`, `isAdmin`) já implementada.
- **Dados de referência:** `apps/cli/data/kalunga/brands.json` (214 marcas raspadas da Kalunga; cada uma com `id` = CNPJ do fornecedor, `name`, `slug`, `url` da página na Kalunga, `products` e `categories`). Há 3 nomes repetidos com ids diferentes (`Spiral`, `HP`, `Trident`): no nosso catálogo eles viram **uma** marca cada. Os dados não trazem logo nem descrição. Não editar esses arquivos.

# Negócio

- Remover o scaffold placeholder `modules/catalog/src/catalog`, `modules/catalog/test/catalog` e `modules/catalog/test/mock/in-memory-catalog.repository.ts`, ajustando `modules/catalog/src/index.ts`.
- Criar o agregado de `brand` (skill: module-aggregate). A skill exige `--mode crud|example`: usar `--mode example` e apagar o use case e o teste gerados, mantendo apenas `model/`, `provider/`, `dto/` e o mock in-memory (`test/mock/in-memory-brand.repository.ts`).
- Alterar a entidade `brand` para possuir os seguintes atributos:
  - `id` — identificador único (`Id`)
  - `name` — nome da marca (obrigatório, `Name`); único no catálogo, comparação sem distinção de maiúsculas
  - `slug` — identificador de URL (obrigatório, `Alias`); único no catálogo; quando não informado é derivado do nome com `Alias.format`
  - `description` — descrição curta da marca (opcional, `Text` até 500 caracteres)
  - `logoUrl` — URL do logotipo (opcional, `Url`)
  - `isActive` — indica se a marca está ativa; padrão `true` (`Flag`)

  Validar com `Result.combine`, expor `create`/`tryCreate` e getters. Ao criar sem `slug`, a entidade gera o slug a partir do nome. (skill: module-entity)

- Criar a interface `brand.repository` estendendo `CrudRepository<Brand>` e adicionando `findBySlug(slug: string): Promise<Result<Brand | null>>` e `findByName(name: string): Promise<Result<Brand | null>>` (ok com `null` quando não existir; `findByName` ignora maiúsculas/minúsculas). Registros com `deletedAt` preenchido nunca são retornados. (skill: module-repository)

- Criar o DTO `BrandDTO` em `modules/catalog/src/brand/dto/brand.dto.ts` com `id`, `name`, `slug`, `description`, `logoUrl`, `isActive`, `createdAt` e `updatedAt`. (skill: module-dto)

- Criar as interfaces de query em `modules/catalog/src/brand/provider/`: `find-brands.query.ts` (`FindBrandsQuery`, contrato `execute(filter: { search?: string; isActive?: boolean }): Promise<Result<BrandDTO[]>>`, ordenada por nome, sem paginação — o volume é de ~200 marcas) e `find-brand-by-id.query.ts` (`FindBrandByIdQuery`, contrato `execute(id: string): Promise<Result<BrandDTO | null>>`). (skill: module-query-cqrs)

- Criar o caso de uso `save-brand.use-case` em `modules/catalog/src/brand/use-case` que recebe por parâmetro o repositório `brand`. Entrada: `{ id?, name, slug?, description?, logoUrl?, isActive? }`. Se não houver `id` ou a marca **não existir** para o `id` informado, é um fluxo de criação (gerar `id` uuid v4 quando ausente; verificar se já existe marca com o mesmo nome — falha `BRAND_NAME_ALREADY_EXISTS`; derivar o slug quando ausente e verificar se já existe marca com o mesmo slug — falha `BRAND_SLUG_ALREADY_EXISTS`; criar a entidade com `isActive = true` por padrão e persistir). Se a marca **já existir**, é um fluxo de alteração (as mesmas verificações de unicidade de nome e slug, ignorando a própria marca; aplicar as alterações via `cloneWith` e persistir). (skill: module-use-case)

- Criar o caso de uso `delete-brand.use-case` em `modules/catalog/src/brand/use-case` que recebe por parâmetro o repositório `brand`. Fluxo: buscar a marca por id (falha `BRAND_NOT_FOUND`) e deletar via soft delete (`deletedAt`). A regra "marca com produtos não pode ser excluída" será adicionada no prompt 13, quando o agregado `product` existir. (skill: module-use-case)

- Criar testes unitários (jest, em `modules/catalog/test/**`) para a entidade `brand` (atributos válidos, nome vazio, slug inválido, slug derivado do nome, URL inválida) e para os dois casos de uso (criação, nome duplicado, slug duplicado, alteração, exclusão, marca inexistente), usando o mock in-memory. Rodar `npm test --workspace=@jaja/catalog`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- Mapear a entidade `brand` em `apps/backend/prisma/models/catalog.model.prisma` (model `Brand`, tabela `brands`, `slug` único, `name` único, `deletedAt` opcional, `@@map` para snake_case). (skill: backend-prisma-data)
- Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_brand` e `npm run prisma:generate --workspace=@jaja/backend`.
- Criar a implementação Prisma do repositório de `brand` em `apps/backend/src/modules/catalog/brand.prisma.ts` (`BrandPrisma`), com `toDomain`/`fromDomain`, retornando `Result`, usando `(tx as PrismaTransactionContext)?.client ?? this.prisma.client` quando receber transação. `delete` faz soft delete (preenche `deletedAt`); todas as buscas filtram `deletedAt: null`. As queries são implementadas nessa mesma classe, cada uma exposta como atributo público tipado com a interface correspondente (`findBrands: FindBrandsQuery`, `findBrandById: FindBrandByIdQuery`), retornando `BrandDTO` mapeado diretamente do resultado do banco (`search` aplica `contains` sem distinção de maiúsculas em `name` e `slug`).
- Remover os placeholders `apps/backend/src/modules/catalog/catalog.prisma.ts` e `catalog.controller.ts` (endpoint `GET /catalog` de exemplo) e registrar `BrandPrisma` como provider em `catalog.module.ts` (o `DbModule` já está importado e fornece o `PrismaService`).
- Criar o `brand.controller` em `apps/backend/src/modules/catalog/brand.controller.ts`, decorado com `@AdminOnly()` na classe (todos os endpoints exigem JWT de administrador), com: (skill: backend-controller)
  - `POST /brands` — criar marca, instanciando `save-brand.use-case` sem `id`; responde `201` com o `BrandDTO` criado
  - `GET /brands` — listar marcas com `?search=&isActive=`, chamando `FindBrandsQuery` diretamente no método do controller (sem caso de uso)
  - `GET /brands/:id` — buscar uma marca, chamando `FindBrandByIdQuery` diretamente; `404` quando `null`
  - `PUT /brands/:id` — atualizar marca, instanciando `save-brand.use-case` com `id`
  - `DELETE /brands/:id` — exclusão lógica, instanciando `delete-brand.use-case`; responde `204`

  Mapeamento de falhas: `BRAND_NOT_FOUND` → `NotFoundException`; `BRAND_NAME_ALREADY_EXISTS` e `BRAND_SLUG_ALREADY_EXISTS` → `ConflictException`; demais falhas do `Result` → `BadRequestException` com os códigos de erro.

- Criar a task de seed `apps/backend/prisma/seed/tasks/catalog-brands.seed.ts` que lê `apps/cli/data/kalunga/brands.json` (caminho resolvido a partir da raiz do monorepo, ex.: `path.resolve(process.cwd(), '../cli/data/kalunga/brands.json')`; falhar com mensagem clara se o arquivo não existir), consolida as marcas por `slug` (os 3 nomes duplicados viram uma marca só), e faz `upsert` por `slug` com `id` uuid v4 gerado na inserção, `name`, `description: null`, `logoUrl: null`, `isActive: true`. Registrar no array `seedTasks` de `apps/backend/prisma/seed/main.ts`, após o seed de usuários. Não copiar os dados para `prisma/seed/data`: a fonte é o arquivo raspado.
- Executar `npm run prisma:seed --workspace=@jaja/backend` e conferir que a tabela `brands` tem 211 registros.
- Criar os testes de integração no padrão Rest Client (VS Code) em `apps/backend/src/modules/catalog/test/brand.integration.http` cobrindo: sem token (401), token de usuário não administrador (403), criação (201), nome duplicado (409), slug duplicado (409), URL de logo inválida (400), listagem com `search` (200), busca por id (200 e 404), alteração (200) e exclusão (204, seguida de 404 na busca). Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e validar as chamadas.

# Frontend

- Criar em `apps/frontend/src/modules/catalog/data/` (arquivos flat, sem subpastas; atualizar `data/index.ts`):
  - `brand.api.ts` — funções de chamada à API (`listBrands`, `getBrand`, `createBrand`, `updateBrand`, `deleteBrand`) com `fetch`, enviando o JWT do `useAuth` no header `Authorization` e tratando o payload de erro `{ statusCode, message, details }` do backend
  - `brand.schema.ts` — schema de validação do formulário com `v` (`@/shared/components/form/validator`) usando os VOs `Name`, `Alias`, `Url` (opcional) e texto opcional até 500 caracteres; tipo `BrandFormData` via `v.infer` (skill: frontend-form-schema)
  - `use-brands.hook.ts` — lista de marcas, filtro por `search` e `isActive`, estado de carregamento e ação de excluir
  - `use-brand-form.hook.ts` — carrega a marca por id no modo edição, submete criação/alteração e trata erros `409` como erro do campo correspondente (`name` ou `slug`)
- Criar a página `brands.page.tsx` em `apps/frontend/src/modules/catalog/pages` que lista as marcas. A lista deve exibir: logotipo (miniatura, com placeholder em `--surface` quando não houver), nome, slug, status (badge "Ativa"/"Inativa") e ações de editar e excluir (excluir com `DeleteConfirmationDialog`). Cabeçalho com `PageSectionHeader`, campo de busca e botão "Nova marca". Rota: `/admin/catalog/brands`.
- Criar o componente `brand-list.component.tsx` em `apps/frontend/src/modules/catalog/components` responsável por renderizar a lista de marcas recebida como prop (`TableCard` + `Table`; `EmptyListState` quando vazia).
- Criar o componente `brand-form.component.tsx` em `apps/frontend/src/modules/catalog/components` com suporte aos fluxos de criação e edição. O formulário **não deve ser implementado via modal** — deve utilizar o componente `form-section-layout` como estrutura de layout, com `react-hook-form` + `v.resolver(brandSchema)`. Campos: `name`, `slug` (preenchido automaticamente a partir do nome com `Alias.format` enquanto o usuário não o editar manualmente), `description` (`Textarea`), `logoUrl` (com pré-visualização quando válida) e `isActive` (`Checkbox`, apenas no fluxo de edição). Página `brand-form.page.tsx` em `modules/catalog/pages` usada pelas rotas `/admin/catalog/brands/new` e `/admin/catalog/brands/[id]`.
- Criar as rotas em `apps/frontend/src/app/admin/catalog/brands/page.tsx`, `brands/new/page.tsx` e `brands/[id]/page.tsx`, e as constantes `CATALOG_BRANDS_ROUTE` e `catalogBrandRoute(id)` em `src/shared/navigation/catalog-routes.ts`. Atualizar `modules/catalog/index.ts`.
- Adicionar o item **"Marcas"** (ícone `Tag` do `lucide-react`, `href: CATALOG_BRANDS_ROUTE`, `match: 'prefix'`) na seção "Cadastros" do módulo Catálogo em `src/shared/navigation/app-modules.ts`.
- Em caso de sucesso em qualquer operação (criar, editar, excluir), exibir toaster de sucesso, voltar para a lista e atualizar a lista de marcas.
- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros; conferir no navegador a lista com as marcas do seed, a criação com slug automático, a edição e a exclusão.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (Backend e Frontend dependem do build de `@jaja/catalog`). Cada subagente deve ler `.claude/skills/skills-standards.md`; o do frontend deve ler também `apps/frontend/DESIGN.md`.
