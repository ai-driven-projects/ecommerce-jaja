# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacote de domínio: `modules/catalog` (`@jaja/catalog`), com os agregados `brand` (prompt 07), `category` (prompt 08) e `product` (prompt 09): repositórios, queries, casos de uso `save-*`/`delete-*`, `errors.ts` por agregado, mocks in-memory e testes. VOs próprios em `modules/catalog/src/product/model/` (`ProductName`, `ProductDescription`, `MoneyCents`, `ProductImage`). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Objetivo:** ligar a loja pública ao catálogo real. Hoje a vitrine (`/`) e o detalhe do produto (`/p/[slug]`) usam só os 26 produtos fictícios de `apps/frontend/src/modules/catalog/data/storefront.mock.ts` (`PRODUCTS`, `findProduct`, `relatedProducts`, `CATEGORY_OPTIONS` com 5 categorias inventadas, emoji no lugar de foto e ficha técnica/estoque inventados). O banco já tem o catálogo da Kalunga: **1.076 produtos** (19 inativos, 96 com preço "De:", 2 sem marca, todos com descrição e de 1 a 10 imagens, média 3,2), **1.111 categorias** em até três níveis (12 raízes, 55 com `isHighlighted`) e **210 marcas**. Os cadastros do admin (`/admin/catalog/*`) já leem e gravam no banco, mas **todos os endpoints do catálogo são `@AdminOnly()`**. Não existe nenhuma rota pública de leitura.
- Spec desta funcionalidade: change `openspec/changes/vitrine-catalogo`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Leitura em CQRS (vale para as três partes):** consultas não seguem o caminho dos comandos.
  - Cada consulta é uma **interface `*Query`** no módulo (em `provider/`, com os DTOs em `dto/`). O adapter Prisma correspondente a implementa como atributo público tipado, e o controller a **chama direto**, sem caso de uso, sem entidade e sem passar pela camada de negócio.
  - A complexidade da leitura fica **no SQL**: regra de visibilidade, hierarquia de categorias, busca, filtros, ordenação, facetas, contagens e campos derivados como o percentual de desconto. O controller só normaliza os parâmetros HTTP, e o adapter só mapeia as linhas para DTO.
  - Caso de uso de leitura só se justifica quando há regras que não cabem em SQL ou é preciso agregar várias consultas distintas. **Nenhuma consulta desta funcionalidade se enquadra nisso.**
  - Seguir o caminho padrão da skill `module-query-cqrs` (interface + implementação Prisma + controller): não criar `find-*.use-case.ts`, serviço de domínio nem teste unitário para as queries. O comportamento é coberto pelo `.http`.
  - Os comandos (`isFeatured` no produto) continuam pela entidade e pelo `save-product.use-case`.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio: `modules/catalog/src/product/**` (entidade, `find-products.query.ts`, `save-product.use-case.ts`) e `modules/catalog/src/category/**` (`find-category-tree.query.ts`, `CategoryDTO.path`/`level`);
  - backend: `apps/backend/src/modules/catalog/category.prisma.ts` e `brand.prisma.ts` (consultas em SQL cru com `$queryRaw`, `SEARCH_DOCUMENT`, `ts_rank` e `COLLATE "pt-BR-x-icu"`), `product.prisma.ts` (mapeamento de linhas para DTO, `isUuid`, tratamento de erros; **não** seguir a árvore de categorias carregada em memória de `findProducts`, porque nas queries novas a hierarquia é resolvida no SQL), `apps/backend/src/db/text-search.sql.ts` (`folded`, `toPrefixTsQuery`), `product.controller.ts` (normalização de `page`/`pageSize`/filtros e `throwFailure`), `test/product.integration.http`;
  - seed e CLI: `apps/backend/prisma/seed/tasks/catalog-products.seed.ts` e `apps/cli/src/commands/scrape/kalunga/seed/{products,types,index}.ts` com `seed.test.ts`;
  - frontend: `modules/catalog/components/storefront.component.tsx`, `storefront-shell.component.tsx`, `storefront-hero.component.tsx`, `product-detail.component.tsx`, `pages/storefront.page.tsx`, `pages/product.page.tsx`, `data/use-storefront.hook.ts`, `data/use-products.hook.ts` (lista com estado na URL), `data/product.api.ts`, `src/app/(public)/page.tsx` e `src/app/(public)/p/[slug]/page.tsx`, e os componentes de loja em `src/shared/components/store/` (`ProductCard`, `ProductGrid`, `ProductArt`, `CategoryChips`, `SectionHeading`, `Price`, `StorefrontSearch`, `StorefrontHeader`, `QuantityStepper`, `store.types.ts`).
- Backend é ESM (`"type": "module"`): imports relativos com sufixo `.js`; testes com Vitest. `@jaja/catalog` é consumido via `dist`: rodar `npm run build --workspace=@jaja/catalog` antes de usá-lo no backend, no CLI e no frontend. **Não há guard global**: uma rota sem `@AdminOnly()` e sem `@UseGuards(JwtGuard)` já é pública (não usar `@Public()`, que só tem efeito junto do `JwtGuard`). Busca textual com `folded`/`toPrefixTsQuery` (cada termo casa o início de uma palavra, sem acento e sem diferenciar maiúsculas, todos os termos obrigatórios). O PostgreSQL já tem a collation `pt-BR-x-icu`.
- Frontend em Next.js 16 com React 19 e React Compiler (`params` e `searchParams` são `Promise`). Grupo público `src/app/(public)` com o `StorefrontShell` (cabeçalho, carrinho e rodapé). Chamadas à API com `apiRequest`/`ApiError`/`toErrorMessage` de `src/shared/util/api-client.util.ts`: o `token` é opcional e as rotas públicas não o enviam. `formatPrice(cents)` em `src/shared/util/price.util.ts`. `next.config.ts` já libera imagens remotas de qualquer host (as fotos vêm de `img.kalunga.com.br`: `thumbUrl` ≈ 200px e `largeUrl` ≈ 1000px). Componentes em `src/shared/components/ui` (`PaginationControls`, `Checkbox`, `Input`, `Sheet`, `Badge`, `Button`, `Combobox`, `EmptyListState`). Design em `apps/frontend/DESIGN.md`.
- **Continuam simulados** (fora desta funcionalidade): bairros atendidos, lojas, ETA e entregadores online (`ZONES`, `UNSERVED_NEIGHBORHOODS`, `ETA_BY_NEIGHBORHOOD`, `COURIERS_ONLINE`, `storeOf`); o **carrinho** (`data/cart.context.tsx`, que resolve itens com `findProduct` do mock), a gaveta e o checkout; o dashboard de `/admin/catalog` (`catalog-dashboard.component.tsx`).
- **Changes em andamento:** `cadastro-loja` e `cadastro-cliente` ainda estão em `openspec/changes/`. `cadastro-loja` altera os requisitos "Catálogo com dados locais" e "Bairro não atendido" de `openspec/specs/catalog/storefront/spec.md` (troca "hub" por "loja"). Se ela ainda não tiver sido arquivada quando esta change for gerada, os deltas desta change partem do texto já alterado por ela.
- **Fora do escopo desta funcionalidade:**
  - carrinho: adicionar produtos reais, trocar `findProduct` do `cart.context.tsx`, a gaveta e o checkout continuam como estão. Na vitrine os cards **não** exibem o "+" e, no detalhe, o botão "Adicionar" aparece mas não altera o carrinho;
  - estoque por loja, disponibilidade por bairro, cobertura real e ETA real;
  - avaliações, parcelamento, sugestões enquanto digita (autocomplete), tolerância a erros de digitação (`pg_trgm`), sinônimos e plural/singular;
  - SEO além de `title`/`description`/Open Graph do detalhe (sitemap, JSON-LD), cache HTTP e ISR;
  - integrar o dashboard `/admin/catalog` à API.

# Negócio

- Adicionar à entidade `Product` (`modules/catalog/src/product/model/product.entity.ts`) o atributo:
  - `isFeatured` — produto em destaque na vitrine (`Flag`); padrão `false`

  Incluir `isFeatured` em `toDTO()`, em `ProductDTO` e em `ProductListItemDTO`. Em `SaveProductInput`, `isFeatured?`: na criação, ausente vira `false`; na alteração, `undefined` mantém o valor atual. Atualizar o mock in-memory e os testes da entidade (padrão `false`) e do caso de uso (criação com e sem `isFeatured`, alteração mantendo e trocando). (skills: module-entity, module-use-case)

- **Visibilidade na loja** (regra comum a todas as queries da vitrine, documentada no JSDoc de cada interface e implementada no SQL): um produto é visível quando não está excluído, está ativo e a categoria dele **e todas as ancestrais** estão ativas e não excluídas. Marca inativa ou excluída **não** esconde o produto: ele aparece como sem marca (`brand: null`) e fica fora das facetas de marca.

- Criar os DTOs de leitura da vitrine (skill: module-dto):
  - `product/dto/storefront-product.dto.ts`:
    - `StorefrontProductListItemDTO` (`id`, `slug`, `name`, `brandName`, `categoryName` (nome da categoria do produto), `rootCategorySlug`, `priceCents`, `listPriceCents`, `discountPercent` (`round((1 - priceCents / listPriceCents) * 100)` quando há preço "De:", senão `null`), `unit`, `thumbUrl` (miniatura da imagem principal ou `null`), `isFeatured`);
    - `StorefrontBrandFacetDTO` (`slug`, `name`, `count`);
    - `StorefrontProductPageDTO` (`items`, `total`, `page`, `pageSize`, `totalPages = ceil(total / pageSize)`, `brandFacets: StorefrontBrandFacetDTO[]`);
    - `StorefrontCategoryRefDTO` (`slug`, `name`);
    - `StorefrontProductDetailDTO` (`id`, `slug`, `name`, `sku`, `description`, `priceCents`, `listPriceCents`, `discountPercent`, `unit`, `isFeatured`, `brand: StorefrontCategoryRefDTO | null` (mesmo formato `slug`/`name`), `categories: StorefrontCategoryRefDTO[]` (da raiz até a categoria do produto) e `images: ProductImageDTO[]` ordenadas).
  - `product/dto/storefront-product-filters.dto.ts`: a constante `STOREFRONT_PRODUCT_SORTS = ['relevance', 'featured', 'price-asc', 'price-desc', 'name', 'discount'] as const`, o tipo `StorefrontProductSort` e `StorefrontProductFiltersDTO` (`page`, `pageSize`, `search?`, `categorySlug?`, `brandSlugs?: string[]`, `minPriceCents?`, `maxPriceCents?`, `onSale?`, `featured?`, `sort?`), já normalizado pelo chamador.
  - `category/dto/storefront-category.dto.ts`: `StorefrontCategoryDTO` (`slug`, `name`, `level`, `parentSlug`, `isHighlighted`, `productCount`, `children: StorefrontCategoryDTO[]`).

- Criar as interfaces de query (skill: module-query-cqrs, só contrato e DTOs, sem use case de leitura):
  - `product/provider/find-storefront-products.query.ts` — `FindStorefrontProductsQuery`, `execute(filter: StorefrontProductFiltersDTO): Promise<Result<StorefrontProductPageDTO>>`, **paginada**, só com produtos visíveis:
    - `search`: busca textual em **nome, sku, marca, nome da categoria do produto e das ancestrais, e descrição**. Cada termo deve casar o início de uma palavra em qualquer um desses campos (termos diferentes podem casar campos diferentes: "caneta bic" casa nome + marca). Relevância por peso: nome, sku e marca > categorias > descrição;
    - `categorySlug`: a categoria e todas as descendentes. Slug inexistente ou de categoria não visível → página vazia (sem erro);
    - `brandSlugs`: qualquer uma das marcas (OU); slugs desconhecidos são ignorados;
    - `minPriceCents`/`maxPriceCents`: intervalo fechado sobre `priceCents`; se `min > max`, os dois são trocados;
    - `onSale`: só produtos com `listPriceCents`; `featured`: só `isFeatured`;
    - todos os filtros combinados com E;
    - `sort`: `relevance` (padrão com `search`; sem `search` vale `featured`), `featured` (padrão sem `search`: destaques primeiro, depois nome), `price-asc`, `price-desc`, `name`, `discount` (maior desconto primeiro, sem desconto no fim). Todas as ordens terminam em nome (ignorando maiúsculas e acentos) e `id`, para as páginas serem estáveis;
    - `brandFacets`: marcas presentes no resultado calculado com **todos os filtros menos `brandSlugs`**, com a contagem de produtos, ordenadas por contagem decrescente e nome, no máximo 30.
  - `product/provider/find-storefront-product-by-slug.query.ts` — `FindStorefrontProductBySlugQuery`, `execute(slug: string): Promise<Result<StorefrontProductDetailDTO | null>>`, `null` quando não existir ou não for visível.
  - `category/provider/find-storefront-categories.query.ts` — `FindStorefrontCategoriesQuery`, `execute(): Promise<Result<StorefrontCategoryDTO[]>>`: árvore das categorias ativas e não excluídas (filha de categoria inativa também fica de fora), com `productCount` = produtos visíveis na categoria e nas descendentes, omitindo as categorias com `productCount = 0`. Irmãs ordenadas por `order`, nome e `id`.

- Exportar tudo nos `index.ts` do agregado. Rodar `npm test --workspace=@jaja/catalog` e `npm run build --workspace=@jaja/catalog`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- Em `apps/backend/prisma/models/catalog.model.prisma`, no model `Product`:
  - `isFeatured Boolean @default(false) @map("is_featured")` com `@@index([isFeatured])`;
  - `searchDocument Unsupported("tsvector")? @map("search_document")` com `@@index([searchDocument], type: Gin)`: coluna **gerada** (`GENERATED ALWAYS AS (...) STORED`) com o documento das colunas do próprio produto: `setweight(to_tsvector('simple', <folded(name)>), 'A') || setweight(to_tsvector('simple', <folded(coalesce(sku, ''))>), 'A') || setweight(to_tsvector('simple', <folded(coalesce(description, ''))>), 'C')`, usando literalmente a expressão que `folded` gera (`lower(translate(...))`, imutável). Comentar acima do model que a coluna evita recalcular o documento das descrições (~790 mil caracteres no seed) a cada busca, e que marca e categorias entram na consulta porque estão em outras tabelas.
  - Gerar a migration com `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_product_storefront --create-only`, escrever à mão o SQL da coluna gerada e do índice GIN, aplicar com `prisma:migrate:dev` e rodar o comando de novo para confirmar que o Prisma não gera outra migration (sem drift). Se o Prisma insistir em diferença na coluna gerada, remover a coluna e montar o documento inteiro na consulta, como em `brand.prisma.ts`, e registrar a decisão no `design.md` da change. Depois, `npm run prisma:generate --workspace=@jaja/backend`. (skill: backend-prisma-data)
- `ProductPrisma`: gravar e ler `isFeatured` em `fromDomain`, `toDomain`, `toDTO`, `toListItem` e no seed (não gravar `search_document`).
- Implementar as queries da vitrine como atributos públicos tipados (`findStorefrontProducts`, `findStorefrontProductBySlug` em `ProductPrisma`; `findStorefrontCategories` em `CategoryPrisma`), mapeando direto para DTO. Toda a regra de leitura fica no SQL; a aplicação não carrega árvores, não filtra e não calcula campos:
  - SQL cru (`$queryRaw` com `Prisma.sql`) no padrão de `brand.prisma.ts`: `products p` com `JOIN categories c1` (a do produto), `LEFT JOIN categories c2` (pai) e `LEFT JOIN categories c3` (avô) para a regra de visibilidade e para os nomes das categorias, e `LEFT JOIN brands b` (só marca ativa e não excluída). A regra de visibilidade do produto fica num fragmento SQL único, reaproveitado pelas três queries (inclusive na contagem de produtos das categorias);
  - documento de busca: `p.search_document || setweight(to_tsvector('simple', <folded(coalesce(b.name, ''))>), 'A') || setweight(to_tsvector('simple', <folded(concat_ws(' ', c1.name, c2.name, c3.name))>), 'B')`, com `@@ to_tsquery('simple', toPrefixTsQuery(search))` e `ts_rank` na ordem `relevance`. A expressão SQL do documento fica numa constante única, reaproveitada no filtro e na ordenação;
  - `categorySlug` resolvido no próprio SQL, com `WITH RECURSIVE` (a categoria e as descendentes visíveis), sem carregar a árvore na aplicação;
  - `discount_percent` calculado no `SELECT` (`round((1 - price_cents::numeric / list_price_cents) * 100)::int` quando `list_price_cents > price_cents`, senão `NULL`), com a mesma expressão reaproveitada na ordenação `discount` (decrescente, nulos por último); nome com `COLLATE "pt-BR-x-icu"`;
  - `count`, página (`LIMIT/OFFSET`) e facetas de marca em consultas separadas, executadas em paralelo; a imagem principal (`order = 0`) por subconsulta ou `LEFT JOIN LATERAL`, sem N+1;
  - `findStorefrontProductBySlug`: **uma única consulta** que traz o produto visível com `discount_percent`, `categories` (da raiz até a categoria do produto, montada no SQL a partir de `c3`/`c2`/`c1`, sem nulos) e `images` (`json_agg` ordenado por `order`); slug vazio não vai ao banco;
  - `findStorefrontCategories`: **uma única consulta** com `WITH RECURSIVE`, que:
    - percorre as categorias visíveis a partir das raízes (filha de categoria inativa fica de fora);
    - calcula `level`, `parentSlug` e `productCount` (produtos visíveis na categoria e nas descendentes, com o fragmento de visibilidade);
    - descarta as categorias com `productCount = 0` e ordena por `order`, nome e `id`.

    O adapter só aninha as linhas em `children` pelo `parentSlug`, sem regra, filtro ou soma.
- Criar `apps/backend/src/modules/catalog/storefront.controller.ts` (`StorefrontController`, `@Controller('storefront')`, **sem guard**) e registrá-lo em `catalog.module.ts`. Só leitura: cada método normaliza os parâmetros HTTP e chama a query direto, sem caso de uso nem entidade: (skill: backend-controller)
  - `GET /storefront/categories` — `200` com `StorefrontCategoryDTO[]`;
  - `GET /storefront/products?search=&category=&brand=&minPriceCents=&maxPriceCents=&onSale=&featured=&sort=&page=&pageSize=` — `page` padrão 1; `pageSize` padrão 24 e máximo 48; `search` com trim; `brand` com slugs separados por vírgula (vazios descartados, no máximo 20); preços aceitos só como inteiros ≥ 0 (senão ignorados); `onSale`/`featured` só com `"true"`; `sort` fora de `STOREFRONT_PRODUCT_SORTS` é ignorado. `200` com `StorefrontProductPageDTO`;
  - `GET /storefront/products/:slug` — `200` com `StorefrontProductDetailDTO`; `404` com `[PRODUCT_NOT_FOUND]` quando `null`;
  - falhas do `Result` viram `BadRequestException` com os códigos, como nos outros controllers.
- `ProductController` (admin): `SaveProductBody` e `toInput` passam a aceitar `isFeatured`; as respostas já trazem o campo pelos DTOs.
- **Dados de referência (destaques):** o `products.json` é gerado pelo CLI, e o backend nunca lê `apps/cli`. Em `apps/cli/src/commands/scrape/kalunga/seed/products.ts`, marcar `isFeatured = true` nos **24** produtos com mais avaliações entre os candidatos: `available === true`, `rating` preenchido, `rating.count >= 10` e `rating.stars >= 4`. Ordem: `rating.count` decrescente, `rating.stars` decrescente e `sku`. Os demais ficam com `false`. Hoje há 285 produtos com avaliação e 143 com 4,5 estrelas ou mais e 10 avaliações ou mais. Adicionar `isFeatured` a `ProductSeedItem` (`seed/types.ts`) e `featured` a `stats`, cobrir a regra em `seed.test.ts` (desempates, indisponível ignorado, limite de 24) e rodar `npm test --workspace=@jaja/cli`. Regenerar o arquivo com o comando `scrape:seed` do CLI (ver `apps/cli/README.md`), que só converte o que já está em `apps/cli/data/kalunga`, sem acessar a Kalunga. Conferir com `git diff` que a única mudança em `products.json` é o novo campo; se houver outras, parar e reportar.
- `catalog-products.seed.ts`: ler `isFeatured` (ausente vira `false`), passar para `Product.tryCreate` e gravar em `fields` (o upsert por `sku` atualiza o destaque).
- Executar `npm run prisma:seed --workspace=@jaja/backend` duas vezes (idempotente) e conferir que há 24 produtos com `is_featured = true`, todos ativos, e que `search_document` está preenchido em todos os produtos.
- Criar `apps/backend/src/modules/catalog/test/storefront.integration.http` (Rest Client, estilo de `product.integration.http`, **sem token**), com o cabeçalho de pré-requisitos (backend rodando, seeds do catálogo aplicados) e requisições nomeadas para reaproveitar slugs. Cenários:
  - categorias (200, raízes ordenadas e com `productCount`);
  - listagem sem filtros (200, `pageSize` 24, destaques primeiro);
  - `search=caneta` e `search=caneta bic` (casando nome + marca);
  - `search` por um sku do seed, pelo nome de uma categoria e por uma palavra que só aparece na descrição;
  - `search` sem termos válidos (`search=%20%21`, lista sem busca);
  - `category` de uma raiz (inclui subcategorias) e slug inexistente (página vazia);
  - `brand` com dois slugs, conferindo `brandFacets` sem o próprio filtro de marca;
  - `minPriceCents`/`maxPriceCents` invertidos;
  - `onSale=true&sort=discount`, `featured=true`, cada `sort`, `sort` inválido (ignorado) e `pageSize=500` (limitado a 48);
  - detalhe por slug (200, `categories` da raiz à folha e `images` ordenadas);
  - slug inexistente e slug de um produto inativo do seed (404 `PRODUCT_NOT_FOUND`);
  - por fim, com token de administrador (como em `brand.integration.http`), `PUT /products/:id` com `isFeatured: true` e a listagem `featured=true` trazendo o produto.

  Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e validar as chamadas. Medir o tempo de `search=papel` e registrá-lo na saída do subagente.
- Validação: `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros.

# Frontend

- **Admin (destaque):** em `data/product.api.ts`, `isFeatured` nos tipos e no `ProductInput`; em `data/product.schema.ts`, `isFeatured` booleano; em `use-product-form.hook.ts`, valor inicial `false` na criação. No `product-form.component.tsx`, a seção **Publicação** passa a aparecer também na criação, com o `Checkbox` "Destaque na vitrine" (texto de apoio "Aparece em “Em destaque” na página inicial da loja"). `isActive` continua só na edição. Em `product-list.component.tsx`, badge "Destaque" ao lado do nome quando `isFeatured`.

- **Dados da loja** em `apps/frontend/src/modules/catalog/data/` (flat; atualizar `data/index.ts`):
  - `storefront.api.ts` — tipos espelhando os DTOs da vitrine (`StorefrontProductListItem`, `StorefrontProductPage`, `StorefrontProductDetail`, `StorefrontCategory`, `StorefrontBrandFacet`, `StorefrontProductSort`, `StorefrontProductFilter`) e as funções `listStorefrontCategories()`, `listStorefrontProducts(filter)` e `getStorefrontProduct(slug)` (devolve `null` no `404` com `PRODUCT_NOT_FOUND` e propaga os demais erros), com `apiRequest` **sem token**. O slug vai com `encodeURIComponent` e a query string só leva os filtros definidos (`brand` juntando os slugs com vírgula).
  - `storefront-query.util.ts` — o estado da vitrine vive na URL, com parâmetros em português como os já existentes: `bairro`, `categoria` (slug; padrão `todas`), `q`, `marca` (slugs separados por vírgula), `precoMin`/`precoMax` (reais, aceitando vírgula), `ofertas=1`, `destaques=1`, `ordem` (`relevancia`, `destaques`, `menor-preco`, `maior-preco`, `nome`, `desconto`) e `pagina`. Funções puras:
    - `parseStorefrontParams(searchParams)`, que descarta valores inválidos;
    - `toStorefrontProductFilter(params, pageSize)`, que converte reais em centavos e `ordem` em `sort`;
    - `buildStorefrontHref(params, changes)`, que volta `pagina` a 1 ao mudar qualquer filtro e omite valores padrão;
    - `hasCatalogFilters(params)`.
  - `storefront-category.util.ts` — `findCategoryBySlug(tree, slug)` e `categoryTrail(tree, slug)` (raiz → categoria).
  - Atualizar `use-storefront.hook.ts`: continua dono de `bairro` (simulado, com `served`, `etaMinutes`, `store`, `neighborhoods`, `stores`). `categoria` passa a ser um slug e `query` passa a preservar **todos** os parâmetros da vitrine (usado nos links dos cards e do checkout). Remover `visibleProducts` e a dependência de `PRODUCTS`. Expor `params` (de `parseStorefrontParams`) e `navigate(changes)`, que usa `router.replace` sem rolar para trocar filtros e `router.push` para trocar página e fazer busca.
  - `use-storefront-categories.hook.ts` — carrega a árvore uma vez por montagem do shell (compartilhada entre cabeçalho, vitrine e detalhe via contexto `StorefrontCatalogProvider` dentro do `StorefrontShell`), com `loading` e erro em `toast.error(toErrorMessage(error))`.
  - `use-storefront-products.hook.ts` — `useStorefrontProducts(filter)`: carrega a página pela chave do filtro, com `loading` derivado da chave, a página anterior mantida durante a troca e erro exposto para o estado de falha com "Tentar de novo". Página além da última volta para a última existente.
  - Remover de `storefront.mock.ts` o que ficar sem uso depois da integração (`relatedProducts`, por exemplo). Manter o que o carrinho, o checkout, o rodapé e o dashboard do admin ainda usam (`findProduct`, `PRODUCTS`, `ZONES`, `ETA_BY_NEIGHBORHOOD`, `COURIERS_ONLINE`, `CATEGORY_OPTIONS`, `categoryLabel`).

- **Componentes de loja compartilhados** (`src/shared/components/store/`, sem importar `modules/*`):
  - `store.types.ts`: `StoreProduct` ganha `imageUrl?: string | null`, `discountPercent?: number | null` e `badge?: 'featured' | null`; `category` passa a ser o slug da categoria raiz (usado só para o tom e o emoji de reserva).
  - `category-art.ts` (novo): mapa de emoji e tom pastel por slug de categoria raiz (`artes-pintura` 🎨, `cartuchos-toners` 🖨️, `coffee-break` ☕, `cuidados-pessoais` 🧴, `envelopes-etiquetas-formularios` ✉️, `escolar` 🎒, `escrita-corretivos` ✏️, `escritorio` 📎, `higiene-limpeza` 🧽, `informatica` 💻, `organizacao` 🗂️, `papeis-pastas` 📄), mantendo as chaves antigas do mock para o carrinho. Reserva: 🛒 e `bg-tint-green`. `product-art.component.tsx` passa a usar esse mapa.
  - `ProductArt`: com `imageUrl`, renderiza `next/image` (`fill`, `object-contain`, `sizes` adequado ao tamanho, `alt` com o nome do produto) sobre fundo `bg-card` com respiro interno. Sem `imageUrl`, mantém o emoji sobre o tom pastel. Falha ao carregar a imagem também volta ao emoji.
  - `ProductCard`: sem `onChangeQuantity` o "+" não aparece (comportamento atual). Selo `−N%` com o `discountPercent` vindo da API; o cálculo local atual fica só como reserva para os produtos do mock. Sem desconto, o selo de ETA. Badge "Destaque" quando `badge === 'featured'` e não há desconto. Nome limitado a 3 linhas (`line-clamp-3`) com o texto inteiro em `title`, porque os nomes da Kalunga chegam a 214 caracteres.
  - `StorefrontSearch` passa a ser funcional: props `defaultValue` e `onSearch(term)`, envio com Enter ou com o botão da lupa, botão "Limpar" (×) quando há texto e `key` pelo `q` atual, para o campo refletir a URL. `StorefrontHeader` repassa `searchValue`/`onSearch`.

- **Shell** (`storefront-shell.component.tsx`): envolver com `StorefrontCatalogProvider`. No `ConnectedHeader`, `onSearch` navega para `/` com `q` e o `bairro` atual, descartando os demais filtros. Termo vazio remove `q`. Vale também a partir de `/p/[slug]`.

- **Vitrine** (`storefront.component.tsx`, reorganizado em componentes menores em `modules/catalog/components/`):
  - **Chips de categoria** (`CategoryChips`): "Tudo" + as raízes da árvore (emoji de `category-art.ts`), ativas pelo slug. Quando a categoria selecionada tem filhas, uma segunda linha de chips menores com "Tudo em <Categoria>" e as filhas, com `productCount`. Selecionar uma neta mantém visíveis a linha da raiz e a do pai.
  - **Bairro não atendido:** mantém o estado vazio atual em qualquer modo (também com busca ou filtros).
  - **Página inicial** (sem `q`, sem filtros e `categoria=todas`), `storefront-home.component.tsx`:
    1. hero atual;
    2. "Em destaque" — `featured`, 12 produtos, "Ver tudo →" para `?destaques=1`;
    3. "Ofertas da semana" — `onSale` + `sort=discount`, 8 produtos em cards `lg`, "Ver tudo →" para `?ofertas=1&ordem=desconto`;
    4. "Categorias em destaque" — até 12 categorias com `isHighlighted` e produtos, em cards brancos com o emoji e o tom da raiz, o nome, "N produtos" e link para `?categoria=<slug>`.

    Seção sem itens não aparece. Remover "Mais pedidos nos escritórios" e "Repor agora".
  - **Listagem** (com `q`, filtros ou categoria), `storefront-listing.component.tsx`:
    - título: `Resultados para “<q>”`, o nome da categoria com a trilha das ancestrais clicável, "Em destaque" ou "Ofertas", nessa prioridade; subtítulo "N produtos";
    - **filtros** numa coluna lateral de 260px em telas `lg` e, abaixo disso, no botão "Filtros (n)" que abre um `Sheet`:
      - **Marca**: `brandFacets` com `Checkbox` e contagem, "Ver todas" depois de 8;
      - **Preço**: dois `Input` em reais e o botão "Aplicar";
      - **Só ofertas** e **Só destaques**: `Checkbox`;
    - **ordenação** em seletor: "Mais relevantes" só com `q`; "Destaques", "Menor preço", "Maior preço", "Nome (A–Z)", "Maior desconto";
    - pílulas dos filtros ativos com "×" e o link "Limpar filtros" (preserva `bairro` e `q`);
    - grade de cards (sem "+"), seguida de `PaginationControls` (`totalLabel: "produtos"`), rolando para o topo da listagem ao trocar de página;
    - carregamento: estrutura estática com blocos `bg-surface` na primeira carga e opacidade reduzida com `aria-busy` nas seguintes;
    - vazio: "Nada por aqui. Já já." com a sugestão de limpar os filtros ou buscar outro termo;
    - erro: mensagem com "Tentar de novo".
  - Os links dos cards usam `productRoute(slug, storefront.query)`.
  - `storefront.page.tsx`: esqueleto sem `CATEGORY_OPTIONS` (chips como blocos `bg-surface`).

- **Detalhe do produto:**
  - `src/app/(public)/p/[slug]/page.tsx`: busca no servidor com `getStorefrontProduct` envolvido em `cache()` do React (uma chamada para `generateMetadata` e a página); `notFound()` quando `null`. Metadados: `title` `<nome> — já já`, `description` com os primeiros 160 caracteres da descrição e `openGraph.images` com a `largeUrl` da imagem principal.
  - `pages/product.page.tsx` e o esqueleto passam a receber `StorefrontProductDetail`.
  - `product-gallery.component.tsx` (novo):
    - imagem principal quadrada com `largeUrl` (`next/image`, `priority` na primeira), selo "Chega em ~X min" e, com mais de uma imagem, botões anterior/próxima e o contador "2/5";
    - miniaturas de 72px com `thumbUrl` para **todas** as imagens (até 10), em faixa com rolagem horizontal, a ativa com borda laranja 2px, `role="tablist"` e navegação por setas do teclado;
    - com uma imagem, sem miniaturas nem botões; sem imagens, o `ProductArt` com emoji.
  - `product-detail.component.tsx`, reescrito sobre `StorefrontProductDetail`:
    - trilha "Início / <categorias da raiz à folha> / <nome>", com links para `/?bairro=…&categoria=<slug>`, e o link "← Voltar aos resultados" quando a `query` recebida tiver `q` ou filtros;
    - badges "Em destaque" e "−N%";
    - marca como link para `/?marca=<slug>`;
    - `h1` com o nome, a unidade em cinza e "Cód. <sku>";
    - `Price` com o preço "De:" riscado;
    - `QuantityStepper` com estado local e o botão "Adicionar · R$ total". O clique **não altera o carrinho**: só exibe `toast("Carrinho chega já já.")`. O botão continua desabilitado quando o bairro não é atendido;
    - cartão de entrega atual (ETA simulado);
    - "Sobre o produto" com a descrição em `whitespace-pre-line`, recolhida em ~8 linhas com "Ler mais"/"Ler menos" quando passar de 600 caracteres;
    - ficha em pares `rótulo · valor`: Marca, Categoria (nomes unidos por " / "), Código e Unidade;
    - remover badges de estoque, emoji e ficha técnica inventados;
    - "Mais de <categoria>": `listStorefrontProducts({ categorySlug: <slug da categoria do produto>, pageSize: 5, sort: 'featured' })` sem o próprio produto, até 4, em cards sem "+"; a seção não aparece sem itens.

- **Design:** atualizar `apps/frontend/DESIGN.md` na mesma mudança:
  - regra de imagem: foto real do produto em `object-contain` sobre branco, com o emoji pastel só como reserva;
  - seções da vitrine ("Em destaque", "Ofertas da semana", "Categorias em destaque") e subcategorias em chips;
  - layout da listagem (filtros laterais/`Sheet`, ordenação, pílulas de filtros ativos, paginação);
  - busca funcional no cabeçalho;
  - galeria do detalhe (imagem principal, setas, contador e miniaturas roláveis);
  - botão "Adicionar" ainda sem carrinho.
- Atualizar `apps/frontend/src/modules/catalog/index.ts` com os componentes novos.

- **Specs da change:**
  - em `catalog/storefront`:
    - substituir "Catálogo com dados locais" por "Catálogo a partir da API" (visibilidade, categorias da árvore e seções da página inicial);
    - alterar "Bairro e categoria na URL" (categoria por slug, com cenários usando slugs reais do seed, e os novos parâmetros) e "Navegação para o detalhe do produto" (detalhe real com galeria, 404 para produto inexistente ou inativo);
    - adicionar requisitos de busca, filtros e ordenação na URL e do botão "Adicionar" sem efeito no carrinho;
    - manter "Sacola vazia nesta entrega" e "Fechar pedido leva ao checkout" sem mudança;
  - nova capability `catalog/storefront-api` com os endpoints públicos, a regra de visibilidade, a busca, filtros, ordenações, facetas e os limites de paginação;
  - em `catalog/product-registration`, alterar os requisitos de atributos/criação (`isFeatured`) e "Seed de produtos a partir da Kalunga" (os 24 destaques por avaliação);
  - em `catalog/product-admin`, alterar "Formulário de produto em seções" (checkbox de destaque também na criação) e "Listagem paginada de produtos" (badge "Destaque").

- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Conferir no navegador:
  - na página inicial: "Em destaque" com os 24 destaques (12 visíveis), "Ofertas da semana" com `−N%` e "Categorias em destaque", todos com fotos reais;
  - nos chips: raízes e subcategorias, com recarga preservando `categoria`;
  - na busca pelo cabeçalho: "caneta bic", "toner hp", um sku e uma palavra da descrição; o campo mostra o termo depois de recarregar;
  - nos filtros: marca com contagens, faixa de preço, só ofertas, todas as ordenações, pílulas e "Limpar filtros", tudo refletido na URL e mantido no reload e no "voltar" do navegador; paginação;
  - em mobile (375px): o `Sheet` de filtros e os chips roláveis;
  - no detalhe: um produto com 10 imagens (galeria, setas, teclado e miniaturas), um com preço "De:", um sem marca, descrição longa com "Ler mais", trilha de categorias, "← Voltar aos resultados", "Adicionar" só com o toast e o contador do carrinho sem mudar, e 404 para um slug inexistente e para um produto inativo;
  - no admin: marcar um produto como destaque e vê-lo em "Em destaque"; os cadastros de Marcas, Categorias e Produtos continuam funcionando, e o checkout continua abrindo.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles, de forma sequencial (Backend, CLI e Frontend dependem do build de `@jaja/catalog`; o Frontend depende da API pública rodando). Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. O do backend também é dono das mudanças no CLI e no seed. O princípio de leitura em CQRS do Contexto prevalece sobre o workflow da skill `module-query-cqrs`. O do frontend deve ler também `apps/frontend/DESIGN.md`. Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.
