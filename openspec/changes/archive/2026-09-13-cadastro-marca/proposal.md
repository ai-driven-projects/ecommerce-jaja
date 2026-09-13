## Why

A área administrativa já tem autenticação e proteção por administrador, mas o catálogo ainda é só um scaffold placeholder: não existe nenhuma entidade de negócio, endpoint ou tela de cadastro. Marca é o cadastro mais simples e é pré-requisito de produtos (prompt 09), então ele inaugura os cadastros do catálogo e estabelece o padrão (domínio, adapter Prisma com queries, controller administrativo, cliente HTTP compartilhado e telas de lista/formulário) que categorias e produtos vão repetir. O catálogo precisa já nascer com as 210 marcas reais raspadas da Kalunga.

## What Changes

- **Pré-requisito (fora desta change)**: a base administrativa do prompt 06 — `@AdminOnly()`/`AdminGuard` no backend (`401` sem token, `403` para não administrador) e a seção "Cadastros" (`catalog-registrations`) no menu do módulo Catálogo, com o `SidebarMenu` exibindo seções rotuladas. Hoje isso ainda não existe no código e deve ser implementado antes, em change própria.
- **Domínio (`@jaja/catalog`)**: remover o scaffold placeholder `catalog` (entidade, caso de uso, DTO, repositório, mock e teste), mantendo `getModuleName()`. Criar o agregado `brand`: entidade `Brand` (`name`, `slug` derivado do nome quando ausente, `description` opcional até 500 caracteres, `logoUrl` opcional http(s), `isActive` padrão `true`), `BrandRepository` (CRUD + `findBySlug` e `findByName` sem distinção de maiúsculas, ignorando excluídos), `BrandDTO`, as queries `FindBrandsQuery` (filtro por `search`/`isActive`, ordenada por nome, sem paginação) e `FindBrandByIdQuery`, e os casos de uso `SaveBrand` (cria ou altera com unicidade de nome e slug) e `DeleteBrand` (soft delete). Testes unitários com jest e mock in-memory.
- **Backend (`@jaja/backend`)**: model Prisma `Brand` (tabela `brands`, `name` e `slug` únicos, `deleted_at`), migration `catalog_brand`, adapter `BrandPrisma` (repositório + queries, soft delete, buscas sem excluídos), controller `/brands` protegido por `@AdminOnly()` com `POST`, `GET` (lista com `search`/`isActive`), `GET /:id`, `PUT /:id` e `DELETE /:id`, seed idempotente das 210 marcas a partir de `apps/cli/data/kalunga/brands.json` e testes de integração Rest Client. **BREAKING**: o endpoint placeholder `GET /catalog` e o `CatalogPrisma` são removidos.
- **Frontend (`@jaja/frontend`)**: cliente HTTP compartilhado `apiRequest`/`ApiError` em `src/shared/util/api-client.util.ts`, para onde `describeApiError` é movido (login e registro mantêm as mesmas mensagens); mensagens pt/en dos códigos `BRAND_*`; tela `/admin/catalog/brands` com lista (logo, nome, slug, status, editar, excluir com confirmação), busca e botão "Nova marca"; formulário em página (não modal) em `/admin/catalog/brands/new` e `/admin/catalog/brands/[id]` com slug automático a partir do nome, pré-visualização do logo e `isActive` só na edição; item "Marcas" na seção "Cadastros" do menu do Catálogo; toaster de sucesso e volta à lista após criar, editar e excluir.

## Capabilities

### New Capabilities

- `catalog/brand-management`: cadastro de marcas do catálogo pela área administrativa: dados e validações da marca, unicidade de nome e slug, derivação do slug, exclusão lógica, contrato HTTP `/brands` restrito a administradores, carga inicial das marcas da Kalunga e as telas de lista e formulário com o item "Marcas" no menu.

### Modified Capabilities

(nenhuma — o item "Marcas" no menu é descrito na nova capacidade; login e registro não mudam de comportamento com a extração do cliente HTTP)

## Impact

- `modules/catalog`: remoção de `src/catalog`, `test/catalog` e `test/mock/in-memory-catalog.repository.ts`; novo `src/brand/{model,provider,dto,use-case}`, `test/brand/**` e `test/mock/in-memory-brand.repository.ts`; `src/index.ts` passa a exportar `brand`. O backend consome o `dist`, portanto depende de `npm run build --workspace=@jaja/catalog`.
- `apps/backend`: `prisma/models/catalog.model.prisma`, nova migration, `prisma/seed/tasks/catalog-brands.seed.ts` registrado em `prisma/seed/main.ts` (lê arquivo de `apps/cli`, sem copiá-lo), `src/modules/catalog/{brand.prisma.ts,brand.controller.ts,catalog.module.ts,test/brand.integration.http}`; remoção de `catalog.prisma.ts` e `catalog.controller.ts`. API nova: `POST/GET /brands`, `GET/PUT/DELETE /brands/:id`.
- `apps/frontend`: `src/shared/util/api-client.util.ts` (novo), `src/modules/auth/data/auth.api.ts` (passa a importar do cliente compartilhado), `src/shared/i18n/messages.{pt,en}.ts`, `src/shared/navigation/{catalog-routes.ts,app-modules.ts}`, `src/modules/catalog/{data,components,pages,index.ts}` e as rotas `src/app/admin/(shell)/catalog/brands/{page.tsx,new/page.tsx,[id]/page.tsx}`.
- Dados: `apps/cli/data/kalunga/brands.json` é somente leitura; o banco passa a ter a tabela `brands` com 210 registros após o seed.
- Sem novas dependências externas.
