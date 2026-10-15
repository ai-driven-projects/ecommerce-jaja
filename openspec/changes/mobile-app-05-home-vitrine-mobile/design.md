## Context

As etapas 1 a 4 (arquivadas) deixaram `lib/core` (`Result`, `Command0/1`, `AppFailure`, `Money`), o tema e os componentes base (`ProductCard`, `ProductArt` com `Image.network`, `AppChip`, `SkeletonBox`, `StateErrorBanner`, `EmptyState`), o cliente `dio` com `runRequest`, a DI com `registerViewModels()`, o router com quatro abas, o domínio `store` com `ApiStoreRepository` (guarda do primeiro `Ok`, requisição compartilhada) e a `HomePage` como `WatchingStatefulWidget` com o `StoreSelector` no topo e um `PlaceholderBody` abaixo. A barreira tem as regras A a E.

Referência no web (só leitura): `apps/frontend/src/modules/catalog/components/{storefront-home,storefront-hero,storefront-product-grid,storefront-category-nav}.component.tsx`, `data/{storefront.api.ts,storefront-category.util.ts}`, `shared/components/store/{category-art.ts,section-heading.component.tsx}` e `apps/frontend/DESIGN.md` ("Página inicial"). Contrato: `StorefrontController` (`GET /storefront/categories` e `GET /storefront/products`, públicos, falha de leitura é `400`) e `modules/catalog/src/{category,product}/dto/storefront-*.dto.ts`.

## Goals / Non-Goals

**Goals:** domínio `catalog` com entidades, consulta, codificação dos filtros e contrato; DTOs e repositório; aba Início completa com os estados uniformes e navegação por callback; `cached_network_image` com a regra F; padrão de bloco remoto reutilizável pelas próximas telas.

**Non-Goals (ficam para outras etapas):**
- Página Buscar de verdade (campo, filtros em bottom sheet, ordenação, paginação, chips de subcategoria) — etapa 6; aqui ela só recebe o filtro decodificado da URL.
- Detalhe do produto (`GET /storefront/products/:slug`, galeria, trilha de categorias) — etapa 7; a rota de produto nasce provisória.
- "+" / stepper no card e ligação com o carrinho — etapa 9 (`action` do `ProductCard` continua nulo).
- Dados fictícios do hero do web (entregadores online, "pedidos ao vivo", CTA que rola a página) — mock no web, não entram em etapa nenhuma.

## Decisions

### 1. Domínio `catalog` (Dart puro, `lib/modules/catalog/`)
- `model/category_entity.dart`: `Category` (`freezed` v3): `slug`, `name`, `level`, `String? parentSlug`, `isHighlighted`, `productCount`, `List<Category> children`.
- `model/product_summary_entity.dart`: `ProductSummary`: `id`, `slug`, `name`, `String? brandName`, `categoryName`, `rootCategorySlug`, `Money price`, `Money? listPrice`, `int? discountPercent` (como a API manda; o app não calcula), `unit`, `String? thumbUrl`, `isFeatured`.
- `model/product_page_entity.dart`: `ProductPage` (`items`, `total`, `page`, `pageSize`, `totalPages`, `brandFacets`) e `BrandFacet` (`slug`, `name`, `count`); as facetas entram porque o DTO converte a resposta inteira, o consumidor chega na etapa 6.
- `model/product_query.dart`: `enum ProductSort { relevance, featured, priceAsc, priceDesc, name, discount }` com `apiValue` (`price-asc`…) e `fromApiValue`; `ProductQuery` (`freezed`): `int? page`, `int? pageSize`, `String? search`, `String? categorySlug`, `List<String> brandSlugs` (padrão vazio), `int? minPriceCents`, `int? maxPriceCents`, `bool onSale`, `bool featured` (padrão `false`), `ProductSort? sort`.
- `model/product_query_params.dart`: `encodeProductQuery(ProductQuery) → Map<String, String>` (espelha `listStorefrontProducts` do web, com os nomes do controller) e `decodeProductQuery(Map) → ProductQuery` (inversa; regras de descarte na spec `mobile-catalog`). **Uma codificação só** serve à API e às rotas do app (`/search?…`): as rotas são internas (deep links fora do escopo), então os nomes em português da URL do web não têm por que existir aqui.
- `model/home_catalog.dart`: `homeFeaturedQuery` (`featured: true, sort: featured, pageSize: 12`), `homeOffersQuery` (`onSale: true, sort: discount, pageSize: 8`), `homeHighlightedCategoriesLimit = 12` e `highlightedCategories(tree, limit)` devolvendo `({Category category, String rootSlug})`, cópia de `storefront-category.util.ts` (origem no comentário).
- `provider/catalog_repository.dart`: `abstract interface class CatalogRepository { Future<Result<List<Category>>> fetchCategories({bool refresh = false}); Future<Result<ProductPage>> fetchProducts(ProductQuery query); }`. Sem use case (regra 4).

### 2. DTOs e repositório
- `lib/infra/api/storefront_category_dto.dart`: `StorefrontCategoryDto.fromJson` recursivo (`children` lista de mapas), casts estritos como o DTO de loja, `toEntity()` e `parseStorefrontCategories(Object?)` (`List.unmodifiable`).
- `lib/infra/api/storefront_product_dto.dart`: `StorefrontProductListItemDto`, `StorefrontBrandFacetDto`, `StorefrontProductPageDto` e `parseStorefrontProductPage(Object?)`. `priceCents`/`listPriceCents` passam por `Money.fromCents`; `Failure` lança `FormatException`, que o `runRequest` converte em `UnexpectedFailure`, como qualquer campo fora do formato. Campos extras ignorados.
- `lib/infra/catalog/api_catalog_repository.dart`: `ApiCatalogRepository(Dio)`. `fetchCategories` com a mesma guarda do `ApiStoreRepository` (primeiro `Ok` guardado, `refresh` ignora, requisição em andamento compartilhada, falha não guardada), porque o web carrega a árvore uma vez por montagem do shell. `fetchProducts` usa `queryParameters: encodeProductQuery(query)` e nunca guarda. Lazy singleton na DI.

### 3. ViewModel da Início e o padrão de bloco remoto
- `lib/ui/modules/catalog/view_models/block_state.dart`: `sealed class BlockState<T>` com `BlockLoading`, `BlockFailed(AppFailure)` e `BlockLoaded(T value)` — classe de apresentação (regra 5) que materializa o padrão "skeleton / banner / conteúdo" do `CLAUDE.md`, reusável pelas próximas telas.
- `lib/ui/modules/catalog/view_models/home_view_model.dart`: `HomeViewModel(CatalogRepository)` com três blocos independentes: `BlockState<List<Category>> categories` (raízes na ordem da API), `BlockState<List<ProductSummary>> featured` e `offers`; três `Command0<void>` (`loadCategories`, `loadFeatured`, `loadOffers`) que põem o bloco em `BlockLoading` ao começar (skeleton também quando já havia dado) e em `BlockLoaded`/`BlockFailed` ao terminar; `loadAll()` dispara os três em paralelo; `refresh()` refaz os três, categorias com `refresh: true`. "Tentar de novo" executa só o command do bloco. Derivados: `highlighted` (limite 12) e `isEverythingEmpty` (os três carregados e vazios).
- `lib/ui/modules/catalog/view_models/category_art.dart`: `CategoryArt({emoji, ProductArtTint tint})` e `categoryArtOf(String rootSlug)` com as 12 raízes de `category-art.ts` (só as chaves por slug; as chaves do catálogo local do web não existem no app) e o padrão 🛒/verde. Fica em `view_models/` por ser formato de tela sem widget (regra 5).
- `lib/ui/shared/formatters/product_count_formatter.dart`: `formatProductCount(int)` → "1 produto"/"24 produtos", ao lado de `money_formatter.dart` porque a etapa 6 ("N produtos" na listagem) é o segundo consumidor já previsto pela spec do web.

### 4. Widgets da Início (`lib/ui/modules/catalog/widgets/`)
- `home_hero.dart`: bloco em `tokens.dark`, raio `AppRadius.xl4`, padding 24; pílula com `Icons.pedal_bike` e "De bike e a pé, saindo da <loja>" (ou "De bike e a pé até você"), fundo `darkSurface`, borda `darkLine`, texto `brandPale`; título "Acabou no escritório?\nChega em minutos." em `displaySmall`, cor `onBrand` (o branco do tema) com "em minutos." em `brandLight`; parágrafo do web em `bodyLarge`/`darkMuted`. Sem CTA, contagem nem cartões fictícios ("uma ação principal por tela").
- `section_heading.dart`: título em `headlineSmall` (Bricolage 24, como `SectionHeading` do web) e, com `onSeeAll`, "Ver tudo →" em `titleSmall`/`brand` com `Semantics(button)`.
- `category_chips_row.dart`: rolagem horizontal de `AppChip` (`selected: false`): "Tudo" com 🛒 e as raízes com o emoji de `categoryArtOf`, espaçamento 8, padding horizontal 16 dentro da rolagem. Skeleton: nove `SkeletonBox` 132×37 em pílula (`CategoryChipsSkeleton` do web). Toque devolve `ProductQuery()` em "Tudo" e `ProductQuery(categorySlug:)` na raiz.
- `product_rail.dart`: `SingleChildScrollView` horizontal com `IntrinsicHeight` + `Row` esticada de `ProductCard` em `SizedBox` de largura fixa (180 nos destaques, 220 nas ofertas, os `minCardWidth` do web; mesma área de imagem de 120, o card `lg` do web não existe no app), espaçamento 14. Trilho em vez de grade porque 20 cards em duas colunas empurrariam as categorias para fora da tela; não é preguiçoso (no máximo 12 itens). Skeleton: `skeletonCount` (6 e 4, como o web) blocos da largura do card e altura `ProductRail.skeletonHeight`, raio `xl2`. Card: `previousPrice: listPrice`, `discountPercent`, `featured`, `imageUrl: thumbUrl`, `emoji`/`tint` de `categoryArtOf(rootCategorySlug)`, `onTap` → `onOpenProduct(slug)`.
- `highlighted_categories_grid.dart`: `GridView` não rolável (`shrinkWrap`, `NeverScrollableScrollPhysics`) de duas colunas, `mainAxisExtent` 74, espaçamento 14; cartão `card` com borda `line`, raio `xl2`, padding 12; quadrado 48 com o emoji sobre o tom da raiz (raio `xl`), nome em `titleSmall` até duas linhas e `formatProductCount` em `bodySmall`/`mutedInk` tabular; `Semantics(button, label: "<nome>, N produtos")`. Skeleton: seis cartões de 74.
- `home_section.dart`: `HomeSection<T>` com `title`, `BlockState<List<T>> state`, `errorTitle`, `onRetry`, `onSeeAll` opcional, `skeleton` e `builder(items)`: `BlockLoading` → cabeçalho sem ação + skeleton; `BlockFailed` → cabeçalho + `StateErrorBanner(title: errorTitle, onRetry)`; carregado e vazio → nada; carregado → cabeçalho com "Ver tudo →" + conteúdo. Títulos de erro: "Não foi possível carregar os destaques.", "…as ofertas.", "…as categorias.".
- Falha das categorias: um banner só, na posição da linha de chips; "Categorias em destaque" não aparece enquanto o bloco não está carregado com itens.

### 5. `HomePage`, navegação por callback e rotas
- `HomePage` ganha `homeViewModelFactory`, `onOpenSearch(ProductQuery)` e `onOpenProduct(String slug)`; materializa os dois ViewModels no `initState`, chama `load` do seletor e `loadAll()`, descarta os dois no `dispose`. Corpo: `RefreshIndicator` sobre `ListView` (`AlwaysScrollableScrollPhysics`, padding 16) com, nesta ordem: `StoreSelector`, linha de chips, `HomeHero(storeName: current?.name)`, "Em destaque", "Ofertas da semana", "Categorias em destaque". `isEverythingEmpty` troca as seções por `EmptyState(emoji: '🛒', title: 'Nada por aqui. Já já.', message: 'O catálogo está vazio no momento.', actionLabel: 'Ver catálogo')` → `onOpenSearch(ProductQuery())`. `onRefresh` = `Future.wait([storeSelector.reload.execute(), home.refresh()])`.
- `AppRoutes`: `product = '/home/product/:slug'`, `productLocation(String slug)` e `searchLocation(ProductQuery)` (`Uri(path: search, queryParameters: …)`, sem `?` quando vazio). O router passa `onOpenSearch: (q) => context.go(AppRoutes.searchLocation(q))` e `onOpenProduct: (slug) => context.push(AppRoutes.productLocation(slug))`; a rota de produto é filha (`routes:`) de `/home`, então fica na pilha da aba Início com a barra inferior visível e volta com `context.pop()`.
- `SearchPage(initialQuery: ProductQuery)` recebe `decodeProductQuery(state.uri.queryParameters)` e continua `PlaceholderBody(title: 'Buscar')`; `ProductPage({slug, onBack})` provisória em `ui/modules/catalog/pages/product_page.dart` com `AppBar` (voltar) e `PlaceholderBody(title: 'Produto')` — a etapa 7 a substitui.

### 6. Fotos com `cached_network_image` e regra F
- `ProductArt` troca `Image.network` por `CachedNetworkImage(imageUrl, fit: contain)`: `imageBuilder` desenha a foto sobre `card` com o respiro de 8; `placeholder` é a área branca vazia (sem shimmer); `errorWidget` é a reserva. Nos testes de página as fixtures usam `thumbUrl: null`; o único teste com URL (`product_card_test.dart`) procura `CachedNetworkImage` e espera a reserva: no `flutter_test` não há canal de plataforma para o cache, e o erro chega pelo fluxo de erro do widget, nunca por rede real.
- Barreira, regra F (`ImportRule.imagePackageConfinement` em `import_rules.dart`): `imagePackages = {'cached_network_image'}` só sob `lib/ui/`; teste real exigindo ao menos um arquivo que importe o pacote; sintéticos para `lib/ui/shared/widgets/x.dart` (aceito), `lib/infra/catalog/x.dart` e `lib/app/x.dart` (violação). A regra C continua valendo nos widgets novos (os tons vêm de `ProductArtTint`).

### 7. DI, fakes e testes de app
- `configureDependencies` registra `CatalogRepository` (lazy singleton) e `registerViewModels()` ganha `HomeViewModel` em `registerFactory`.
- `registerFakeDependencies({storeRepository, catalogRepository})` registra também um `FakeCatalogRepository` (padrão: fixtures do seed) e continua devolvendo o fake de loja. `FakeCatalogRepository` (`test/modules/catalog/support/`) responde por fila (`enqueueCategories`, `enqueueProducts`, `holdProducts()`, `holdCategories()`), registra `productQueries` e `categoryCalls` (o `refresh` de cada chamada).
- `bootstrap_test` enfileira quatro respostas (lojas, categorias e duas páginas vazias) e confere os caminhos como conjunto (a ordem das cargas paralelas não é garantida).

### 8. `CLAUDE.md`
Só acréscimos: "Estado atual" com a etapa 5; regra F na seção de infraestrutura; `encodeProductQuery`/`decodeProductQuery` como codificação única dos filtros (API e rotas); `BlockState` como forma dos blocos remotos; `categoryArtOf` como única fonte de emoji/tom; em "Regras de domínio", o item "Catálogo" (consultas da Início, seção vazia some, árvore guardada enquanto o app está aberto, produtos nunca guardados).

## Dependências da etapa anterior

Conferido no código entregue pela etapa 4 (se algo mudar até a aplicação, adaptar sem renomear o que existe): `runRequest` e `FakeHttpClientAdapter`; `ApiStoreRepository` (molde da guarda e da requisição compartilhada); `StoreSelectorViewModel` (`load`, `reload`, `current`) e `StoreSelector`; `HomePage(storeSelectorViewModelFactory:)`; `registerViewModels()`, `registerFakeDependencies()` e `FakeStoreRepository` (`hold()`, `enqueue`, `fetchCalls`); `store_fixtures.dart`; `ProductCard`, `ProductArt` (`height = 120`), `ProductArtTint`, `AppChip`, `SkeletonBox`, `StateErrorBanner`, `EmptyState`, `PlaceholderBody`; tokens `dark`, `darkMuted`, `darkLine`, `darkSurface`, `brandLight`, `brandPale`, `onBrand`; `AppRadius.{xl, xl2, xl4, pill}`; `textTheme.{displaySmall, headlineSmall, titleSmall, bodyLarge, bodySmall}`; `import_rules.dart` com as regras A a E; `freezed ^4.0.0-dev.3` já instalado.

## Decisões tomadas sem consulta

- Hero compacto: só pílula, título e parágrafo do web; nada dos dados fictícios.
- Destaques e ofertas em trilhos horizontais (larguras 180 e 220 do web), não em grade; a grade fica para a listagem da etapa 6.
- Linha de chips "Tudo" + raízes na Início (como o `StorefrontCategoryNav` do web), todos inativos; tocar abre a Buscar filtrada.
- Falha das categorias mostra um banner só (na linha de chips); falha de uma seção de produtos, só nela. Seção vazia some; tudo vazio vira `EmptyState` "Nada por aqui. Já já." com "Ver catálogo" (título do web, mensagem nova).
- Codificação única dos filtros com os nomes da API nas rotas do app, em vez dos nomes em português da URL do web.
- Árvore de categorias guardada enquanto o app está aberto (como as lojas); produtos nunca.
- Rota de produto `/home/product/:slug` aninhada em `/home` (barra inferior visível), página provisória "Produto" até a etapa 7; `SearchPage` recebe `initialQuery` e continua provisória até a etapa 6.
- `formatProductCount` em `ui/shared/formatters/`; `categoryArtOf` e `BlockState` em `view_models/` do catálogo.
- `cached_network_image` substitui `Image.network` no `ProductArt`; a prova do caminho da foto nos testes é a reserva (sem canal de plataforma nem rede).
- Nenhuma lacuna de API encontrada: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [`cached_network_image` traz `flutter_cache_manager`, `sqflite`/`path_provider` transitivos] → só o pacote permitido entra no `pubspec`; a regra F o confina a `lib/ui`; nos testes nenhuma foto é carregada de verdade.
- [Trilho com `IntrinsicHeight` mede todos os cards] → no máximo 12 por trilho; se pesar, a etapa 6 pode fixar a altura.
- [Quatro requisições ao abrir a Início] → categorias e lojas ficam guardadas; só produtos repetem.
- [`decodeProductQuery` ignora valor inválido em silêncio] → mesmo comportamento do controller e do web; a etapa 6 testa os casos da listagem.
- [Versão de `cached_network_image` incompatível com o SDK] → `flutter pub add` resolve; nunca `pub upgrade`; versão registrada aqui na aplicação.
