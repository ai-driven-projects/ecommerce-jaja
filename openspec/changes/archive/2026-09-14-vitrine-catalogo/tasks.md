> **Execução:** três subagentes separados, com contexto limpo, **nessa ordem**:
> - **Negócio:** grupo 1;
> - **Backend:** grupos 2–5, incluindo o CLI e o seed;
> - **Frontend:** grupos 6–9.
>
> Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/12-vitrine-catalogo.md`, o `design.md` desta change e as referências de código da sua camada listadas no Contexto do prompt;
> - Frontend, além disso: `apps/frontend/DESIGN.md`.
>
> **Leitura em CQRS** (Decisão 2 do `design.md`): as consultas da vitrine são interfaces no módulo, implementadas em SQL no adapter Prisma e chamadas direto pelo controller. Não criar `find-*.use-case.ts`, serviço de domínio nem teste unitário para elas.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. Domínio `@jaja/catalog` (subagente Negócio)

- [x] 1.1 Adicionar `isFeatured` (`Flag`, padrão `false`) à entidade `Product` (skill `module-entity`), a `toDTO()`, a `ProductDTO` e a `ProductListItemDTO`. Verificar em `modules/catalog/test/product/product.entity.test.ts` que um produto criado sem `isFeatured` tem `false`, e com `true` mantém `true`.
- [x] 1.2 Aceitar `isFeatured?` em `SaveProductInput` (skill `module-use-case`) e ajustar o mock in-memory:
  - na criação, ausente vira `false`;
  - na alteração, `undefined` mantém o atual.

  Verificar em `save-product.use-case.test.ts`: criação sem e com `isFeatured`, alteração sem `isFeatured` mantendo `true` e alteração trocando para `false`.
- [x] 1.3 Criar os DTOs da vitrine (skill `module-dto`):
  - `src/product/dto/storefront-product.dto.ts`: `StorefrontProductListItemDTO`, `StorefrontBrandFacetDTO`, `StorefrontProductPageDTO`, `StorefrontCategoryRefDTO` e `StorefrontProductDetailDTO`;
  - `src/product/dto/storefront-product-filters.dto.ts`: `STOREFRONT_PRODUCT_SORTS`, `StorefrontProductSort` e `StorefrontProductFiltersDTO`;
  - `src/category/dto/storefront-category.dto.ts`: `StorefrontCategoryDTO`.

  Todos com os campos da spec `catalog/storefront-api`. Verificar com `npx tsc --noEmit -p modules/catalog`.
- [x] 1.4 Criar as interfaces `FindStorefrontProductsQuery` (`src/product/provider/find-storefront-products.query.ts`), `FindStorefrontProductBySlugQuery` (`find-storefront-product-by-slug.query.ts`) e `FindStorefrontCategoriesQuery` (`src/category/provider/find-storefront-categories.query.ts`), com a skill `module-query-cqrs` só para contrato e DTOs. O JSDoc de cada uma deve trazer a regra de visibilidade, e o de `FindStorefrontProductsQuery` também busca, filtros, ordenações e facetas. Verificar com `npx tsc --noEmit -p modules/catalog` e com `find modules/catalog/src -name "*storefront*use-case*"` vazio.
- [x] 1.5 Exportar os novos arquivos nos `index.ts` de `dto`, `provider` e do agregado. Verificar:
  - `npm test --workspace=@jaja/catalog` passa;
  - `npm run build --workspace=@jaja/catalog` gera um `dist/index.d.ts` que exporta `FindStorefrontProductsQuery`, `FindStorefrontProductBySlugQuery`, `FindStorefrontCategoriesQuery`, `STOREFRONT_PRODUCT_SORTS` e `StorefrontCategoryDTO`.

## 2. Backend: banco e destaque (subagente Backend)

- [x] 2.1 Em `apps/backend/prisma/models/catalog.model.prisma`, no model `Product` (skill `backend-prisma-data`):
  - `isFeatured Boolean @default(false) @map("is_featured")` com `@@index([isFeatured])`;
  - `searchDocument Unsupported("tsvector")? @map("search_document")` com `@@index([searchDocument], type: Gin)`;
  - o comentário da Decisão 5 do `design.md`.

  Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_product_storefront --create-only` e escrever no SQL da migration:
  - `is_featured` com padrão `false` e índice;
  - `search_document tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', <folded(name)>), 'A') || setweight(to_tsvector('simple', <folded(coalesce(sku, ''))>), 'A') || setweight(to_tsvector('simple', <folded(coalesce(description, ''))>), 'C')) STORED`, com a expressão literal gerada por `folded`;
  - o índice GIN.

  Aplicar com `prisma:migrate:dev` e rodar o comando de novo. Verificar:
  - nenhuma nova migration é proposta;
  - `SELECT count(*) FROM products WHERE search_document IS NULL` retorna `0`;
  - se o Prisma insistir em diferença, remover a coluna, montar o documento inteiro na consulta e registrar a troca na Decisão 5 do `design.md`.

  Depois, rodar `npm run prisma:generate --workspace=@jaja/backend`.
- [x] 2.2 Em `ProductPrisma`, ler e gravar `isFeatured` em `fromDomain`, `toDomain`, `toDTO` e `toListItem`, sem gravar `search_document`. Em `ProductController`, aceitar `isFeatured` em `SaveProductBody` e em `toInput`. Verificar que o backend compila e que `PUT /products/:id` com `isFeatured: true` responde com o campo, na tarefa 5.1.

## 3. Backend: consultas e API pública da vitrine (subagente Backend)

- [x] 3.1 Em `ProductPrisma`, criar as constantes SQL únicas (Decisões 4, 5 e 7 do `design.md`):
  - fragmento de visibilidade: `products p JOIN categories c1 LEFT JOIN categories c2 LEFT JOIN categories c3`, com produto e categorias ativos e não excluídos, e `LEFT JOIN brands b` só com marca ativa e não excluída;
  - documento de busca: `p.search_document` com a marca (peso A) e os nomes de `c1`/`c2`/`c3` (peso B);
  - `discount_percent`.

  Verificar que o backend compila.
- [x] 3.2 Implementar `findStorefrontProducts: FindStorefrontProductsQuery` em SQL cru:
  - `search` com `toPrefixTsQuery`, e `ts_rank` para `relevance`;
  - `categorySlug` resolvido por `WITH RECURSIVE` (a categoria e as descendentes);
  - `brandSlugs` com `IN`;
  - faixa de preço com troca quando `min > max`;
  - `onSale` e `featured`;
  - as seis ordenações terminando em `name COLLATE "pt-BR-x-icu", id`;
  - `count`, página com `LEFT JOIN LATERAL` da imagem principal e facetas sem o filtro de marca (`LIMIT 30`) em `Promise.all`.

  Verificar que o backend compila; o comportamento é validado na tarefa 5.1.
- [x] 3.3 Implementar `findStorefrontProductBySlug: FindStorefrontProductBySlugQuery` numa única consulta:
  - produto visível com `discount_percent`;
  - `categories` da raiz até a folha, montadas de `c3`/`c2`/`c1` sem nulos;
  - `images` com `json_agg` ordenado por `order`;
  - slug vazio devolve `null` sem ir ao banco.

  Verificar que o backend compila.
- [x] 3.4 Implementar `findStorefrontCategories: FindStorefrontCategoriesQuery` em `CategoryPrisma` numa única consulta `WITH RECURSIVE` (Decisão 6):
  - calcula `level`, `parentSlug` e `productCount` com o fragmento de visibilidade;
  - omite a subárvore de categorias inativas e as categorias com `productCount = 0`;
  - ordena por `order`, nome e `id`.

  O adapter só aninha as linhas por `parentSlug`. Extrair o fragmento de visibilidade para um arquivo compartilhado do módulo, sem duplicá-lo entre os dois adapters. Verificar que o backend compila.
- [x] 3.5 Criar `apps/backend/src/modules/catalog/storefront.controller.ts` (`@Controller('storefront')`, sem guard; skill `backend-controller`) e registrá-lo em `catalog.module.ts`:
  - `GET /storefront/categories`;
  - `GET /storefront/products`, normalizando `page` (padrão 1), `pageSize` (padrão 24, máximo 48), `search` (trim), `category`, `brand` (vírgulas, vazios descartados, até 20), `minPriceCents`/`maxPriceCents` (inteiros ≥ 0), `onSale`/`featured` (só `"true"`) e `sort` (só valores de `STOREFRONT_PRODUCT_SORTS`);
  - `GET /storefront/products/:slug`, com `404 [PRODUCT_NOT_FOUND]` quando `null`.

  Cada método chama a query direto, sem caso de uso. Verificar:
  - `npm run build --workspace=@jaja/backend` compila;
  - `grep -n "AdminOnly\|JwtGuard\|UseCase" apps/backend/src/modules/catalog/storefront.controller.ts` não encontra nada.

## 4. CLI e seed: destaques (subagente Backend)

- [x] 4.1 Em `apps/cli/src/commands/scrape/kalunga/seed/products.ts`, marcar `isFeatured` (Decisão 8):
  - `true` nos 24 primeiros candidatos (`available === true`, `rating.count >= 10`, `rating.stars >= 4`), ordenados por `rating.count` decrescente, `rating.stars` decrescente e `sku`;
  - `false` nos demais.

  Adicionar `isFeatured` a `ProductSeedItem` (`seed/types.ts`) e `featured` a `stats`. Verificar com `npm test --workspace=@jaja/cli` que `seed.test.ts` cobre:
  - indisponível ignorado mesmo com mais avaliações;
  - desempate por estrelas e por sku;
  - limite de 24;
  - produto sem avaliação com `false`.
- [x] 4.2 Rodar `npm run build --workspace=@jaja/catalog` e, em `apps/cli`, `npm run cli -- scrape:seed`, respondendo não à pergunta de popular o banco. Verificar:
  - `git diff --stat apps/backend/prisma/seed/data` só altera `products.json`;
  - `git diff` mostra apenas a inclusão de `isFeatured`;
  - o arquivo tem 24 itens com `"isFeatured": true`, todos com `"isActive": true`.

  Se houver outras diferenças, parar e reportar.
- [x] 4.3 Em `apps/backend/prisma/seed/tasks/catalog-products.seed.ts`, ler `isFeatured` (ausente vira `false`), passá-lo a `Product.tryCreate` e incluí-lo em `fields` do upsert. Rodar `npm run prisma:seed --workspace=@jaja/backend` duas vezes. Verificar:
  - `SELECT count(*) FROM products` retorna `1076`;
  - `SELECT count(*) FROM products WHERE is_featured` retorna `24`;
  - nenhum desses 24 está inativo.

## 5. Backend: integração e validação (subagente Backend)

- [x] 5.1 Criar `apps/backend/src/modules/catalog/test/storefront.integration.http` (Rest Client, sem token, estilo de `product.integration.http`), com os cenários do prompt. Subir o backend (`npm run dev --workspace=@jaja/backend`) e verificar, chamada a chamada:
  - `GET /storefront/categories`: 12 raízes com `productCount`;
  - listagem padrão: `total: 1057`, `totalPages: 45` e os 24 destaques primeiro;
  - busca: `search=caneta bic`, `search=CAFÉ` igual a `search=cafe`, um sku, o nome de uma subcategoria, uma palavra só da descrição e `search=%20%21` sem efeito;
  - `category=cartuchos-toners` com as subcategorias e `category=papelaria` vazio;
  - `search=toner` com e sem `brand=hp`, com as mesmas `brandFacets`;
  - preços invertidos;
  - `onSale=true&pageSize=48` com `total: 96`;
  - cada `sort`, `sort=aleatorio` e `pageSize=500` (48);
  - detalhe de `cabeca-de-impressao-magenta-ciano-c9383a-hp-cx-1-un` com 10 imagens em ordem e `categories` a partir de "Cartuchos & Toners";
  - detalhe de `saco-para-lixo-banheiro-34x40cm-branco-dover-rl-100-un` com `brand: null`;
  - `404 PRODUCT_NOT_FOUND` para `nao-existe` e para `cartucho-lexmark-dual-pack-1un-17-1un-27-10n0595-lexmark-cx-1-un`;
  - com token de administrador, `PUT /products/:id` com `isFeatured: true`, e o produto aparecendo em `featured=true`;
  - a mesma chamada de categorias com um token expirado respondendo `200`.

  Registrar o tempo de `search=papel`.
- [x] 5.2 Verificar que `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` passam sem erros.

## 6. Frontend: destaque no admin (subagente Frontend)

- [x] 6.1 Adicionar `isFeatured`:
  - em `product.api.ts`, nos tipos e no `ProductInput`;
  - em `product.schema.ts`, como booleano;
  - em `use-product-form.hook.ts`, com `false` na criação e o valor atual na edição.

  No `product-form.component.tsx`, exibir a seção Publicação também na criação, com o `Checkbox` "Destaque na vitrine" e o texto de apoio, deixando ativo/inativo só na edição. Em `product-list.component.tsx`, exibir o badge "Destaque" ao lado do nome. Verificar no navegador que criar um produto com o destaque marcado envia `isFeatured: true`, que a edição carrega o valor e que a lista mostra o badge.

## 7. Frontend: dados e componentes compartilhados da loja (subagente Frontend)

- [x] 7.1 Criar `apps/frontend/src/modules/catalog/data/storefront.api.ts` com os tipos da vitrine e as funções `listStorefrontCategories`, `listStorefrontProducts` e `getStorefrontProduct`:
  - `apiRequest` sem token;
  - `null` no `404 PRODUCT_NOT_FOUND`;
  - query string só com os filtros definidos e `brand` unido por vírgula.

  Verificar com `npm run build --workspace=@jaja/frontend`.
- [x] 7.2 Criar `storefront-query.util.ts` com `parseStorefrontParams`, `toStorefrontProductFilter`, `buildStorefrontHref` e `hasCatalogFilters` (Decisão 9), e `storefront-category.util.ts` com `findCategoryBySlug` e `categoryTrail`. Verificar com um script `tsx` descartável, fora do repositório, que:
  - `precoMin=12,90` vira `minPriceCents: 1290`;
  - `ordem=menor-preco` vira `sort: 'price-asc'`;
  - valores inválidos são descartados;
  - mudar um filtro remove `pagina`;
  - valores padrão não entram no href.
- [x] 7.3 Atualizar `use-storefront.hook.ts`:
  - `categoria` passa a ser slug;
  - `query` passa a levar todos os parâmetros;
  - expor `params` e `navigate(changes)`, com `replace` para filtros e `push` para página e busca;
  - remover `visibleProducts` e `PRODUCTS`.

  Criar o contexto `StorefrontCatalogProvider` com `use-storefront-categories.hook.ts` e o `use-storefront-products.hook.ts` (chave pelo filtro, página anterior mantida, erro exposto, página além da última corrigida). Remover de `storefront.mock.ts` só o que ficar sem uso. Verificar:
  - `npm run build --workspace=@jaja/frontend` compila;
  - `grep -rn "storefront.mock" apps/frontend/src` só aponta para carrinho, checkout, rodapé, dashboard e `data/index.ts`.
- [x] 7.4 Nos componentes de `src/shared/components/store/` (Decisão 12):
  - `StoreProduct` ganha `imageUrl`, `discountPercent` e `badge`;
  - criar `category-art.ts` com emoji e tom por slug de raiz, mantendo as chaves antigas;
  - `ProductArt` usa `next/image` com `object-contain` e volta ao emoji sem imagem ou em `onError`;
  - `ProductCard` mostra o selo pela prioridade desconto > Destaque > ETA, com `line-clamp-3` e `title` no nome;
  - `StorefrontSearch` fica funcional (`defaultValue`, `onSearch`, limpar) e `StorefrontHeader` repassa as props.

  Verificar com `npm run lint --workspace=@jaja/frontend` e com o carrinho e o checkout, ainda com o mock, abrindo sem erro no navegador.

## 8. Frontend: vitrine (subagente Frontend)

- [x] 8.1 No `storefront-shell.component.tsx`, envolver com `StorefrontCatalogProvider`. No `ConnectedHeader`, ligar a busca: `q` com o `bairro` atual, descartando os demais filtros, e termo vazio removendo `q`. Verificar no navegador que buscar "caneta bic" em `/?bairro=Meireles&categoria=escolar&ordem=menor-preco` leva a `/?bairro=Meireles&q=caneta+bic`, e que buscar a partir de `/p/<slug>` também funciona.
- [x] 8.2 Refazer os chips de categoria (raízes com emoji, segunda linha de subcategorias com contagem e netas mantendo as linhas) e o `storefront-home.component.tsx`:
  - hero;
  - "Em destaque" (12);
  - "Ofertas da semana" (8, `discount`, cards `lg`);
  - "Categorias em destaque" (até 12);
  - seções vazias ocultas;
  - sem "Mais pedidos nos escritórios" e "Repor agora".

  Ajustar o esqueleto de `storefront.page.tsx`. Verificar no navegador os cenários "Página inicial com o seed", "Selecionar uma raiz" e "Selecionar uma subcategoria" da spec `catalog/storefront`.
- [x] 8.3 Criar `storefront-listing.component.tsx`:
  - título por prioridade e contagem;
  - filtros de marca, preço, só ofertas e só destaques, na coluna lateral em `lg` e em `Sheet` abaixo disso;
  - seletor de ordenação, com "Mais relevantes" só com `q`;
  - pílulas e "Limpar filtros";
  - grade sem "+" e `PaginationControls`, rolando ao topo;
  - estados de carregamento, vazio ("Nada por aqui. Já já.") e erro ("Tentar de novo").

  Manter o estado "bairro não atendido" em todos os modos. Verificar no navegador os cenários "Filtrar por marca e preço", "Recarregar e voltar", "Limpar filtros", "Sem resultados" e "Filtros em tela estreita" (375px).

## 9. Frontend: detalhe, design e validação final (subagente Frontend)

- [x] 9.1 Em `src/app/(public)/p/[slug]/page.tsx`, carregar com `getStorefrontProduct` envolvido em `cache()`, usar `notFound()` para `null` e gerar os metadados (`<nome> — já já`, descrição de 160 caracteres, Open Graph com a `largeUrl`). `pages/product.page.tsx` e o esqueleto passam a receber `StorefrontProductDetail`. Verificar:
  - `curl -s -o /dev/null -w "%{http_code}" localhost:3000/p/nao-existe` retorna `404`, e o mesmo vale para o slug do produto inativo;
  - o título da aba de um produto real é `<nome> — já já`.
- [x] 9.2 Criar `product-gallery.component.tsx`: imagem principal com setas e contador, miniaturas roláveis com `role="tablist"` e setas do teclado, sem controles com uma imagem e com o emoji sem imagens. Verificar no navegador os cenários "Produto com 10 imagens" e "Teclado" com `cabeca-de-impressao-magenta-ciano-c9383a-hp-cx-1-un`.
- [x] 9.3 Reescrever `product-detail.component.tsx` sobre `StorefrontProductDetail`:
  - trilha de categorias e "← Voltar aos resultados";
  - selos, marca como link, "Cód." e preço "De:";
  - stepper e "Adicionar" só com o toast "Carrinho chega já já.";
  - cartão de entrega;
  - descrição com "Ler mais";
  - ficha (marca, categoria, código e unidade);
  - "Mais de <categoria>" com até 4 cards sem "+";
  - sem estoque, emoji ou ficha inventados.

  Verificar no navegador os cenários "Clique no card", "Voltar pela trilha", "Produto com preço “De:”" e "Clicar em Adicionar" (o contador do carrinho não muda).
- [x] 9.4 Atualizar `apps/frontend/DESIGN.md` (foto real com emoji de reserva, seções da vitrine, listagem, busca, galeria e "Adicionar" sem carrinho) e `apps/frontend/src/modules/catalog/index.ts`. Verificar com `grep -n "sem fotos" apps/frontend/DESIGN.md` vazio e com o build do frontend.
- [x] 9.5 Verificar que `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` passam. Conferir no navegador, com o backend e o seed atualizados:
  - todos os fluxos da validação do prompt 12;
  - no admin, marcar um produto como destaque e vê-lo em "Em destaque";
  - os cadastros de Marcas, Categorias e Produtos e o checkout continuam funcionando.
