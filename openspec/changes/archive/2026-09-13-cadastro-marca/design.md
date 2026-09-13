## Context

Motivação e escopo em `proposal.md`; comportamento em `specs/catalog/brand-management/spec.md`. Estado atual relevante:

- `modules/catalog` só tem o scaffold `src/catalog` (`Catalog`, `CreateCatalog`, `CatalogDTO`, `CatalogRepository`), o mock `test/mock/in-memory-catalog.repository.ts`, `test/catalog/create-catalog.use-case.test.ts` e `getModuleName()` com `test/index.test.ts`. O backend consome `@jaja/catalog` pelo `dist`.
- O shared (`packages/shared`) já oferece o necessário: `Name` (2–100), `Alias` (com `Alias.format`, que por padrão remove hífens nas pontas: `make-` → `make`), `Text` (`{ optional, maxLength }`), `Url` (`Url.isValid`, só http/https), `Flag`, `Entity` (com `deletedAt` e `cloneWith`) e `CrudRepository<T>` (`findById` devolve `Result<T>`, sem `null`).
- Backend: `apps/backend/prisma/models/catalog.model.prisma` só tem o comentário; `CatalogModule` registra `CatalogController` (`GET /catalog`) e `CatalogPrisma`; `user.prisma.ts` é a referência de adapter (`Result.tryAsync`, `clientFor(tx)`); `auth.controller.ts` é a referência de mapeamento de falhas (`uniqueCodes`, `ConflictException`/`BadRequestException`). O seed roda com `npx tsx prisma/seed/main.ts`, então `import.meta.url` resolve para o arquivo-fonte e o caminho `../../../../cli/data/kalunga/brands.json` a partir de `prisma/seed/tasks` chega em `apps/cli/data/kalunga/brands.json`.
- Dados: `brands.json` tem 214 entradas e 210 slugs distintos após `Alias.format` (repetidos: `spiral` ×2, `hp` ×3 com "HP"/"Hp", `trident` ×2; único slug inválido: `make-`). Nenhum nome tem tamanho fora de 2–100 e nenhum nome se repete com slugs diferentes.
- Frontend: `auth.api.ts` concentra `describeApiError` (com o dicionário local `INVALID_CREDENTIALS`/`EMAIL_ALREADY_EXISTS` e fallback em `errorMessagesPt`) e um `postJson` próprio. Schemas usam `v` de `@/shared/components/form/validator` com VOs do shared (`login.schema.ts`); toasts usam `sonner`; `useAuth()` expõe `session`. Os componentes `FormSectionLayout`, `TableCard`, `Table`, `EmptyListState`, `PageSectionHeader`, `DeleteConfirmationDialog`, `Badge`, `Checkbox` e `Textarea` já existem em `src/shared/components/ui`.
- **Pré-requisito ausente**: o prompt 06 (`@AdminOnly()` + `AdminGuard` no backend; seções rotuladas no `SidebarMenu` e seção `catalog-registrations` em `app-modules.ts`) ainda não foi implementado — hoje `shared/decorators` só tem `current-user` e `public`, e `sectionsByModuleId.catalog` é `[]`.

## Goals / Non-Goals

**Goals:**
- Estabelecer o padrão de cadastro administrativo (domínio → adapter Prisma com queries → controller → cliente HTTP compartilhado → lista + formulário em página) que categorias (08) e produtos (09) vão copiar.
- Manter o domínio independente de Prisma/Nest e testável com mock in-memory.

**Non-Goals:**
- Implementar o prompt 06 (pré-requisito, change própria).
- Regra "marca com produtos não pode ser excluída" (prompt 09).
- Upload de logotipo, paginação, ordenação configurável, restauração de marcas excluídas e filtro por status na tela (a API e o hook aceitam `isActive`, a tela expõe só a busca).
- Unicidade de nome sem distinção de caixa no nível do banco (garantida pelo domínio; ver Riscos).

## Decisions

### 1. Três etapas sequenciais com contexto limpo
A implementação segue a ordem Negócio → Backend → Frontend, cada etapa em um subagente separado com contexto limpo, conforme o prompt. Cada subagente lê `.claude/skills/skills-standards.md`; o de frontend também lê `apps/frontend/DESIGN.md`. Backend e Frontend dependem do `npm run build --workspace=@jaja/catalog` feito no fim da etapa de Negócio. Antes de tudo, uma verificação barata confirma que o prompt 06 existe; sem ele a etapa de backend não tem `@AdminOnly()` e o item "Marcas" não tem seção onde entrar.

### 2. Scaffold pela skill e poda
`module-aggregate brand --mode example` gera a estrutura padrão; o use case e o teste de exemplo são apagados, mantendo `model/`, `provider/`, `dto/` e `test/mock/in-memory-brand.repository.ts`. Alternativa (escrever tudo à mão) descartada para manter nomes e barrels iguais aos dos próximos agregados.

### 3. Entidade deriva o slug
`Brand.tryCreate` recebe `slug` opcional e, quando vazio, usa `Alias.format(name)` antes de validar com `Alias`. Validação por `Result.combine` de `Id`, `Name`, `Alias`, `Text` (`{ optional: true, maxLength: 500 }`), `Url` (`{ optional: true }`) e `Flag` (padrão `true`). Colocar a derivação na entidade (e não só no use case) garante a mesma regra para seed, testes e `cloneWith`. O seed usa `Alias.format` diretamente porque não instancia a entidade.

### 4. `SaveBrand` como upsert de domínio
Entrada `{ id?, name, slug?, description?, logoUrl?, isActive? }`, saída `BrandDTO` (o controller devolve o DTO em `201`/`200`).
- `findById` que falha **com** `BRAND_NOT_FOUND` → fluxo de criação; qualquer outra falha é propagada (não se transforma em criação por engano de banco).
- Criação: `id` = informado ou uuid v4 novo; `findByName` → `BRAND_NAME_ALREADY_EXISTS`; slug = informado ou `Alias.format(name)`; `findBySlug` → `BRAND_SLUG_ALREADY_EXISTS`; `Brand.tryCreate` com `isActive ?? true`; `create`.
- Alteração: mesmas verificações, conflito só quando o registro encontrado tem outro `id`; `cloneWith` com os campos enviados. `undefined` mantém o valor atual (inclusive `slug` e `isActive`); `null` ou `''` limpa `description`/`logoUrl`. Manter o slug na alteração evita quebrar URLs quando o nome muda.
- A ordem (unicidade antes da validação da entidade) segue o prompt; entrada inválida ainda termina em falha de validação porque buscas com nome/slug vazio não encontram nada.

`DeleteBrand`: `findById` (propaga `BRAND_NOT_FOUND`) → `repository.delete(id)`. O soft delete fica no adapter; o mock in-memory reproduz o contrato (marca `deletedAt` e passa a não retornar o registro).

### 5. Nome/slug de marca excluída continuam reservados
Decisão do usuário. O banco mantém `name @unique` e `slug @unique` (necessário também para o `upsert` por slug no seed). Como as buscas do repositório ignoram excluídos, a colisão aparece só no `create`/`update`: o `BrandPrisma` traduz a violação de unicidade do Prisma (`P2002`) pelo campo afetado — `name` → `BRAND_NAME_ALREADY_EXISTS`, `slug` → `BRAND_SLUG_ALREADY_EXISTS`, chave primária `id` → `BRAND_NOT_FOUND` (é o caso de `PUT` para o id de uma marca excluída, que caiu no fluxo de criação). O controller já mapeia esses códigos para `409`/`404`. Alternativa descartada: índices únicos parciais (`WHERE deleted_at IS NULL`) escritos à mão, que liberariam os valores mas tirariam `slug` dos campos únicos do Prisma e complicariam o seed.

### 6. Adapter único com repositório e queries
`BrandPrisma implements BrandRepository` no padrão de `user.prisma.ts`, com `delete` fazendo `update({ deletedAt: new Date() })` e todas as leituras com `deletedAt: null` (`findFirst` em vez de `findUnique` quando o filtro extra impede o `where` único). `findByName` usa `equals` com `mode: 'insensitive'`. As queries são atributos públicos tipados (`findBrands: FindBrandsQuery`, `findBrandById: FindBrandByIdQuery`) que mapeiam a linha direto para `BrandDTO`, sem passar pela entidade; `search` usa `OR` de `contains`/`insensitive` em `name` e `slug`. A ordenação por nome é feita no adapter com `Intl.Collator('pt-BR', { sensitivity: 'base' })` sobre o resultado: o Postgres do container ordena por bytes (maiúsculas antes de minúsculas) e o Prisma não aceita `mode: 'insensitive'` em `orderBy`; com ~200 marcas o custo é desprezível e o resultado não depende do collation do banco. Um único provider mantém o `CatalogModule` simples; a separação CQRS fica nas interfaces.

### 7. Controller administrativo fino
`@Controller('brands')` + `@AdminOnly()` na classe, injetando só `BrandPrisma`. `POST` (`@HttpCode(201)`) e `PUT` instanciam `SaveBrand` (o `PUT` usa o `id` da rota, ignorando `id` do corpo); `GET` chama as queries direto; `DELETE` (`@HttpCode(204)`) instancia `DeleteBrand`. `isActive` da query string só é aplicado quando for exatamente `"true"` ou `"false"`; outros valores são ignorados. Falhas: códigos deduplicados como em `auth.controller.ts`; `BRAND_NOT_FOUND` → `NotFoundException`, `BRAND_NAME_ALREADY_EXISTS`/`BRAND_SLUG_ALREADY_EXISTS` → `ConflictException`, resto → `BadRequestException`. `GET /brands/:id` com resultado `null` → `NotFoundException(['BRAND_NOT_FOUND'])`.

### 8. Seed só insere
`seedCatalogBrands` lê o JSON (erro claro com o caminho quando ausente), normaliza com `Alias.format`, consolida por slug mantendo o primeiro nome e faz `upsert({ where: { slug }, create: { id: randomUUID(), name, slug, description: null, logoUrl: null, isActive: true }, update: {} })`. `update: {}` torna o seed idempotente sem sobrescrever edições nem ressuscitar marcas excluídas pelo administrador. Registrado em `seedTasks` depois de `seedAuth`.

### 9. Cliente HTTP compartilhado sem mudar o auth
`src/shared/util/api-client.util.ts` recebe `describeApiError`, `ApiErrorPayload`, os auxiliares e as mensagens genérica/de rede, exatamente como estão (inclusive o dicionário `INVALID_CREDENTIALS`/`EMAIL_ALREADY_EXISTS`). Exporta `ApiError extends Error { status; codes }` e `apiRequest<T>(path, { method = 'GET', token, body })`. `auth.api.ts` só troca os imports e mantém o `postJson` próprio, minimizando o risco de regressão nas mensagens de login/registro.

### 10. Dados e telas do frontend
- `brand.api.ts`: funções puras sobre `apiRequest`, recebendo `token`. `listBrands` monta a query string só com filtros definidos.
- `brand.schema.ts`: `v.defineObject` com `Name`, `Alias`, texto opcional até 500 e `Url` opcional (forma de opcional definida pela skill `frontend-form-schema`); `isActive` boolean.
- `use-brands.hook.ts`: busca ao montar e quando `search`/`isActive` mudam (busca com debounce curto para não disparar uma requisição por tecla); `remove(id)` exclui, mostra o toaster e recarrega.
- `use-brand-form.hook.ts`: no modo edição carrega por id (404 → toaster de erro e volta para a lista); no submit, `ApiError` `409` vira `setError` em `name`/`slug` pelo código; demais erros viram toaster com `error.message`; sucesso → toaster + `router.push(CATALOG_BRANDS_ROUTE)`. A lista é remontada na navegação e busca de novo, o que cumpre "voltar e atualizar".
- Slug automático: flag local `slugTouched`, iniciada `false` na criação e `true` na edição (editar o nome de marca existente não reescreve o slug, coerente com a Decisão 4).
- Rotas finas em `app/admin/(shell)/catalog/brands/**` só renderizam as páginas do módulo; `[id]/page.tsx` faz `await params`.
- Menu: item `catalog-brands` (`Tag`, `CATALOG_BRANDS_ROUTE`, `match: 'prefix'`) dentro da seção `catalog-registrations` criada pelo prompt 06.

## Risks / Trade-offs

- [Prompt 06 não implementado] → Tarefa 0 verifica e interrompe; nada desta change tenta recriar `@AdminOnly()` ou o `SidebarMenu` com seções.
- [Formato do `P2002` com driver adapter (`@prisma/adapter-pg`, Prisma 7): o campo pode vir em `meta.target` ou só no nome da constraint/erro do driver] → a tradução inspeciona `meta.target` e, como alternativa, o nome da constraint (`brands_name_key`, `brands_slug_key`, `brands_pkey`); coberto pelos cenários 409/404 do `.http`.
- [`name @unique` no banco diferencia caixa; a regra "sem distinção" vale só para marcas não excluídas via domínio. Excluir "Acme" e criar "ACME" com outro slug é aceito] → trade-off aceito; exigiria índice por `lower(name)` em SQL manual.
- [Corrida entre duas criações simultâneas com o mesmo nome] → a constraint do banco barra a segunda e a Decisão 5 devolve `409`.
- [Seed falha se um administrador tiver criado, com outro slug, uma marca com o mesmo nome de uma marca da Kalunga] → só afeta bancos de desenvolvimento; a mensagem do Prisma identifica o nome.
- [Mover `describeApiError` quebrar mensagens do login/registro] → movimentação literal + validação manual em `/entrar` e `/admin/login` na etapa final.
- [210 linhas sem paginação] → volume pequeno e fixo; paginação fica para quando o catálogo crescer.
- [Conflito documental: `openspec/specs/shared/design-system` exige cantos retos, enquanto `apps/frontend/DESIGN.md` descreve raio pílula em botões/badges] → fora do escopo; as telas usam os componentes compartilhados como estão e seguem o `DESIGN.md`, como o prompt pede.

## Migration Plan

1. Depois do prompt 06: `npm run build --workspace=@jaja/catalog`.
2. `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_brand` (cria só a tabela `brands`, sem tocar em `users`/`passwords`) e `prisma:generate`.
3. `npm run prisma:seed --workspace=@jaja/backend` (idempotente).
4. Rollback em desenvolvimento: reverter o commit e recriar o banco com `prisma migrate reset`; não há dados de produção.
