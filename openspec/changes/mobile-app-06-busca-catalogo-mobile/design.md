## Context

As etapas 1 a 5 (arquivadas) deixaram o domínio `catalog` com `ProductQuery`/`ProductSort` (`freezed`), `encodeProductQuery`/`decodeProductQuery` (a codificação única de API e rotas), `ProductPage` com `brandFacets`, `Category` em árvore, `highlightedCategories` e o contrato `CatalogRepository` (`fetchCategories({refresh})` guarda a árvore; `fetchProducts(query)` nunca guarda), o `ApiCatalogRepository`, o `BlockState<T>` e o `categoryArtOf` em `ui/modules/catalog/view_models/`, o `ProductRail` (que monta `ProductCard` a partir de `ProductSummary`), o `formatProductCount`, o `formatMoney`, a `HomePage` como molde de `WatchingStatefulWidget` com fábrica de ViewModel, e a `SearchPage(initialQuery)` provisória, montada pela rota `/search` com `decodeProductQuery(state.uri.queryParameters)`. A Início navega para a Buscar com `context.go(AppRoutes.searchLocation(query))`.

Referência de comportamento (só leitura): `apps/frontend/src/modules/catalog/data/{storefront-query.util.ts,use-storefront-products.hook.ts,storefront-category.util.ts}` e `components/{storefront-listing,storefront-filters}.component.tsx`. Contrato: `StorefrontController.listProducts` (`DEFAULT_PAGE_SIZE` 24, `MAX_PAGE_SIZE` 48, `MAX_BRAND_SLUGS` 20, valor inválido ignorado) e `STOREFRONT_PRODUCT_SORTS` em `modules/catalog/src/product/dto/storefront-product-filters.dto.ts`.

## Goals / Non-Goals

**Goals:** regras puras da listagem testáveis sem Flutter; um ViewModel que concentra filtro, espera da busca, paginação e descarte de resposta velha; a aba Buscar com painel de filtros, painel de ordenação, pílulas, grade com paginação infinita e os estados uniformes; filtro espelhado na rota da aba.

**Non-Goals (ficam para outras etapas):**
- Detalhe do produto (galeria, preço, descrição, `GET /storefront/products/:slug`) — etapa 7; a rota de produto da Buscar abre a mesma `ProductPage` provisória.
- "+" no card e ligação com o carrinho — etapa 9 (`action` do `ProductCard` continua nulo).
- Varredura de textos repetidos e testes finais de DI/rotas — etapa 15.
- Linhas de chips de categoria/subcategoria do web: no app a categoria fica no painel de filtros (o plano pede filtros em bottom sheet) e aparece como pílula; nenhuma etapa traz as linhas de chips para a Buscar.
- Deep links e a URL em português do web (`q`, `categoria`, `pagina`…): fora do escopo do plano; a rota do app usa a codificação única da etapa 5.

## Decisions

### 1. Regras puras da listagem (`lib/modules/catalog/model/`)
- `product_listing.dart` (origem no comentário: `storefront-query.util.ts` e `storefront-listing.component.tsx`):
  - `listingPageSize = 24` e `maxBrandSlugs = 20` (o `LISTING_PAGE_SIZE` do web e o `MAX_BRAND_SLUGS` do controller).
  - `effectiveSort(ProductQuery)`: `sort ?? (search != null ? relevance : featured)`; `listingSorts(ProductQuery)`: as seis ordens na ordem do web, sem `relevance` quando não há busca.
  - `normalizeListingQuery(ProductQuery)`: zera `page`/`pageSize`, apara `search` (vazio → `null`), marcas sem vazias e sem repetição, no máximo 20, e `sort: relevance` sem busca vira `null` (o `applyStorefrontChanges` do web). É o filtro "em vigor" do ViewModel; tudo o que entra (rota, painel, campo) passa por ela, então comparar dois filtros é comparar duas `ProductQuery` normalizadas (igualdade do `freezed`).
  - `hasCatalogFilters(q)`: categoria, marcas, preço, ofertas ou destaques; `clearCatalogFilters(q)`: zera esses cinco, mantendo `search` e `sort`. Diferente do web (que mantém a categoria), aqui a categoria entra porque mora no mesmo painel e vira pílula — ver "Decisões tomadas sem consulta".
  - `listingPageQuery(q, page)`: `q.copyWith(page: page, pageSize: listingPageSize)`, a consulta enviada ao repositório.
- `category_tree.dart`: `categoryTrail(tree, slug)` (cópia de `storefront-category.util.ts`, caminho da raiz até o slug, vazio se não existe) e `flattenCategoryTree(tree)` em pré-ordem, devolvendo a própria `Category` (o recuo usa `level`).
- Sem use case (regra 4): o repositório existente basta.

### 2. Preço digitado (`lib/ui/modules/catalog/view_models/price_input.dart`)
`parseReaisToCents(String)` → `int?` e `formatCentsAsReais(int)` → `String`, cópias de `storefront-query.util.ts` (aceita `R$`, espaços, `12,90`, `12.90`, `1.290,90`, `300`; vazio, negativo ou mais de duas casas → `null`; `30000` → `300`, `1290` → `12,90`). Fica em `view_models/` por ser formato de tela sem widget (como `categoryArtOf`); o rótulo da pílula de preço usa o `formatMoney` existente.

### 3. `SearchViewModel` (`lib/ui/modules/catalog/view_models/search_view_model.dart`)
- Construtor `SearchViewModel(CatalogRepository, {Duration searchDelay = const Duration(milliseconds: 300)})`; `registerFactory` na DI.
- Estado exposto: `query` (normalizado, sem página), `searchText` (o que está no campo), `results: BlockState<List<ProductSummary>>` (primeira página), `total`, `brandFacets`, `hasMore`, `loadingMore`, `loadMoreFailure: AppFailure?`, `categories: BlockState<List<Category>>` e `filteredCategory` (último nó de `categoryTrail`, ou `null`).
- Entradas: `start(ProductQuery)` (primeira montagem: categorias + `applyQuery`), `applyQuery(q)` (rota), `onSearchChanged(text)`, `submitSearch(text)`, `clearSearch()`, `setSort`, `setCategory(String?)`, `toggleBrand(slug, selected)`, `setPriceRange(min, max)`, `setOnSale`, `setFeatured`, `removeBrand`, `clearPrice`, `clearFilters()`, `retry()`, `refresh()`, `loadMore` (`Command0`) e `loadCategories` (`Command0`, o "Tentar de novo" do grupo Categoria).
- Todo caminho de mudança passa por um `_apply(next)` privado: normaliza; se igual ao `query` atual, não faz nada; senão troca o `query`, limpa itens, página, falhas e facetas, põe `results` em `BlockLoading` e pede a página 1.
- **A primeira página não usa `Command`**: `Command0.execute` ignora chamadas enquanto roda, e uma troca de filtro no meio de um pedido precisa valer. Cada pedido leva o número de geração do filtro (`_generation`, incrementado em `_apply`, `retry` e `refresh`); resposta de geração antiga é descartada, tanto da página 1 quanto da seguinte. `loadMore` é `Command0` (ignorar reentrada é o desejado) e não faz nada sem `results` carregado, sem `hasMore` ou com `loadMoreFailure` pendente (o rodapé pede o "Tentar de novo"); o "Tentar de novo" do rodapé limpa a falha e executa `loadMore` de novo para a mesma página.
- Itens da página seguinte são acrescentados pulando `id` já presente (o catálogo pode mudar entre páginas). `hasMore` = página carregada < `totalPages`. `total` e `brandFacets` vêm da última página recebida.
- Espera da busca: `onSearchChanged` guarda o texto, notifica e reinicia um `Timer(searchDelay)` que chama `_apply(query.copyWith(search: texto))`; `submitSearch` e `clearSearch` cancelam o timer e aplicam na hora; `applyQuery` também cancela e iguala `searchText` ao termo recebido; `dispose` cancela o timer.
- `refresh()` pede as categorias com `refresh: true` e a página 1 do mesmo filtro (nova geração), sem passar pela igualdade.
- O padrão "valor em campo próprio, skeleton por getter" da `HomeViewModel` continua; aqui o `BlockLoading` é atribuído em `_apply`, porque a primeira página não é `Command`.

### 4. Página e widgets (`lib/ui/modules/catalog/`)
- `SearchPage` (`WatchingStatefulWidget`) recebe `searchViewModelFactory`, `initialQuery`, `onQueryChanged(ProductQuery)` e `onOpenProduct(String slug)`. No `initState` cria o ViewModel e chama `start(initialQuery)`; no `didUpdateWidget`, se `initialQuery` mudou, chama `applyQuery`. Um ouvinte do ViewModel chama `onQueryChanged(vm.query)` sempre que o `query` muda (pós-frame, para não navegar durante o build), e volta a rolagem ao topo.
- Estrutura: campo de busca fixo no topo (fora da rolagem); abaixo, `RefreshIndicator` sobre `CustomScrollView` com: linha com "Filtros (n)" e o botão de ordem; título e contagem; pílulas; e a grade (ou o skeleton, o banner, o vazio) mais o rodapé.
- `widgets/search_field.dart`: `TextField` com ícone de lupa, dica "Buscar produtos", `TextInputAction.search` (`onSubmitted` → `submitSearch`) e `IconButton` "Limpar busca" (tooltip) só com texto. Widget próprio em vez de estender o `AppTextField`, que sempre tem rótulo visível; o estilo vem do tema como no `AppTextField`. O `TextEditingController` é da página e é igualado a `vm.searchText` quando os dois diferem (filtro vindo da rota, "Limpar busca").
- `widgets/product_grid.dart`: `SliverList` preguiçosa de linhas com dois cards (`IntrinsicHeight` + `Expanded`, espaçamento 14), não `SliverGrid` de altura fixa — mesmo motivo da grade de categorias na etapa 5 (nome em duas linhas e escala de texto estouram altura fixa). Linha ímpar deixa o último card à esquerda. `ProductGridSkeleton(count)` usa `SkeletonBox` da altura `ProductRail.skeletonHeight`.
- `widgets/product_summary_card.dart`: a montagem `ProductSummary` → `ProductCard` que hoje está dentro do `ProductRail` sai para cá e passa a ser usada pelos dois (segundo consumidor); o comportamento do trilho não muda e os testes dele continuam passando.
- Paginação: `NotificationListener<ScrollNotification>` chama `loadMore` quando `extentAfter < 600`; depois de cada página carregada, uma checagem pós-frame faz o mesmo se o conteúdo não encheu a tela (lista curta nunca rola). Rodapé: skeleton de uma linha enquanto `loadingMore`; `StateErrorBanner(title: "Não foi possível carregar mais produtos.")` com `loadMoreFailure`; nada no fim.
- `widgets/active_filter_pills.dart`: `Wrap` de `AppChip(selected: true)` com ícone de fechar e "Limpar filtros" (`AppButton` texto); rótulos e ordem da Decisão 5. Contagem do botão "Filtros (n)" = quantidade de pílulas.
- `widgets/filters_sheet.dart`: `showFiltersSheet(context, vm)` com `showModalBottomSheet(isScrollControlled: true, useSafeArea: true)`, altura máxima de 90% da tela, cabeçalho "Filtros" com fechar, corpo rolável com os quatro grupos da spec e rodapé fixo ("Limpar filtros" e `AppButton` principal "Ver N produtos"). O conteúdo é `WatchingWidget` que observa o mesmo ViewModel (`target:`), então cada toque aplica na hora e o rodapé acompanha. Categoria: linhas tocáveis com recuo `16 × (level − 1)`, `formatProductCount` em `bodySmall` e ícone de marcado na escolhida (`Semantics(selected:)`), sem `Radio` (a API de grupo do `Radio` mudou nas versões recentes do Flutter). Marca e ofertas/destaques: `CheckboxListTile` do tema. Preço: dois `AppTextField` (`TextInputType.numberWithOptions(decimal: true)`) num `StatefulWidget` com chave pelos valores em vigor (o `key` do web), "Aplicar" com `AppButton` secundário.
- `widgets/sort_sheet.dart`: `showSortSheet(context, {current, options}) → Future<ProductSort?>` com "Ordenar por" e uma linha por opção (mesma marcação da categoria); rótulos do web num mapa `ProductSort → String` no próprio arquivo.
- Textos da página como constantes públicas da `SearchPage` (`errorTitle`, `emptyTitle`, `emptyMessage`…), como na `HomePage`.

### 5. Título, pílulas e vazio
- Título: busca → `Resultados para “<termo>”`; categoria → `filteredCategory.name`, "…" com `categories` em `BlockLoading`, "Produtos" com falha ou slug desconhecido; `featured` → "Em destaque"; `onSale` → "Ofertas"; senão "Produtos". Contagem: "…" com `results` em `BlockLoading`, senão `formatProductCount(total)`; some com `BlockFailed`.
- Pílulas, nesta ordem: categoria (nome; slug enquanto a árvore não carrega ou falha), marcas (nome da faceta, senão slug), preço ("R$ 12,90 a R$ 300,00", "a partir de R$ 12,90", "até R$ 300,00"), "Só ofertas", "Só destaques".
- Vazio: `EmptyState(emoji: '🔎', title: 'Nada por aqui. Já já.', message: 'Tente limpar os filtros ou buscar outro termo.')` com uma ação: "Limpar filtros" (`clearFilters`) se `hasCatalogFilters`; senão "Limpar busca" (`clearSearch`) se há termo; senão "Atualizar" (`refresh`).

### 6. Rotas e DI
- `AppRoutes.searchProduct = '/search/product/:slug'`, `searchProductSegment = 'product/:slug'` e `searchProductLocation(slug)`; a rota filha de `/search` monta a `ProductPage` provisória com `onBack: context.pop`.
- O builder de `/search` passa `searchViewModelFactory: () => getIt<SearchViewModel>()`, `initialQuery: decodeProductQuery(...)`, `onQueryChanged: (q) => context.go(AppRoutes.searchLocation(q))` e `onOpenProduct: (slug) => context.push(AppRoutes.searchProductLocation(slug))`. Como o `query` do ViewModel já é normalizado (sem página), a rota nunca carrega `page`/`pageSize` vindos do app.
- O `go` para a mesma rota com outra query reconstrói a `SearchPage` com o mesmo `State` (a chave da página do `go_router` é o caminho casado, sem a query); com `initialQuery` igual ao `query` em vigor, `applyQuery` não faz nada. Um teste prova que a fábrica do ViewModel é chamada uma vez só ao trocar filtros.
- `registerViewModels()` ganha `SearchViewModel` (`registerFactory`). Nenhum pacote novo e nenhuma pasta nova de camada: a barreira não muda.

### 7. Testes
- Regras puras e preço: `test/modules/catalog/model/` e `test/ui/modules/catalog/view_models/`.
- `catalog_fixtures.dart` ganha `manyProducts(int count, {String prefix})` (cópias de `finePen` com `id`/`slug`/`name` únicos) e uma faceta `hpFacet`; o `pageOf` do fake ganha parâmetros nomeados opcionais (`page`, `totalPages`, `total`, `brandFacets`), sem quebrar quem o usa.
- Os testes do ViewModel que dependem do `Timer` rodam em `testWidgets` e avançam o relógio com `tester.pump(duration)` (o `fake_async` não é dependência direta e não está na lista permitida); os demais são `test` comuns.
- Widget tests com o viewport alto (800×2400) quando precisam da grade inteira, como na Início; a paginação é testada com `tester.drag`/`scrollUntilVisible` num viewport normal.

### 8. `CLAUDE.md`
Só acréscimos: "Etapa 6" no estado atual; em "Regras de domínio › Catálogo", a listagem (24 por página, ordem efetiva, `normalizeListingQuery` como porta única do filtro, filtro espelhado na rota, resposta velha descartada por geração); em "Estados de tela remota", a variante de paginação (skeleton só na página 1, falha da página seguinte só no rodapé).

## Dependências da etapa anterior

Conferido no código da etapa 5 (se algo mudou até a aplicação, adaptar sem renomear o que existe): `ProductQuery`/`ProductSort.apiValue`/`fromApiValue`, `encodeProductQuery`/`decodeProductQuery`, `ProductPage`/`BrandFacet`, `Category.{slug,name,level,productCount,children}`, `CatalogRepository`, `BlockState`, `categoryArtOf`, `ProductRail` (`skeletonHeight` 228) e `ProductRailSkeleton`, `formatProductCount`, `formatMoney`, `AppRoutes.{search,searchLocation,productSegment}`, `ProductPage({slug,onBack})` provisória, `SearchPage(initialQuery)`, `registerViewModels()`, `FakeCatalogRepository` (`enqueueProducts`, `holdProducts()`, `holdCategories()`, `productQueries`, `categoryCalls`) e `pageOf`, fixtures `categoryTree` (com `toners-hp`, 12 produtos) e `products`, `holdImageLoad` para cards com `thumbUrl` (o `registerFakeDependencies` já tira as fotos).

## Decisões tomadas sem consulta

- Categoria no painel de filtros (o plano pede categoria no bottom sheet), com pílula própria, contada em "Filtros (n)" e limpa por "Limpar filtros"; no web ela mora nas linhas de chips e "Limpar filtros" a mantém.
- Troca de filtro mostra o skeleton da grade, não os itens antigos esmaecidos como o web: o `CLAUDE.md` manda skeleton em toda recarga.
- Espera de 300 ms na busca (o `SEARCH_DEBOUNCE_MS` dos hooks do web); a vitrine web só busca ao enviar, o plano pede espera no app.
- `page`/`pageSize` da rota são ignorados pela listagem infinita (sempre começa da 1, sempre 24) e nunca são escritos pelo app.
- Mudanças no painel valem na hora, como no web; o botão principal "Ver N produtos" só fecha.
- Vazio sem filtro e sem termo (catálogo vazio) usa a ação "Atualizar", para manter "uma ação" no estado vazio.
- Fim da lista sem mensagem (o web também não tem); o rodapé simplesmente some.
- Item repetido entre páginas é pulado pelo `id`.
- Produto aberto da Buscar fica na pilha da Buscar (`/search/product/<slug>`), para voltar à listagem com a rolagem e os itens.
- Nenhuma lacuna de API encontrada: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [`context.go` a cada mudança de filtro recriar a página] → o teste da fábrica chamada uma vez prova o contrário; se a versão do `go_router` mudar a chave, a página passa a guardar o ViewModel fora do `State` só nesse caso e a decisão é registrada.
- [Muitas requisições ao marcar várias opções seguidas no painel] → cada uma descarta a anterior pela geração; nenhuma resposta velha aparece.
- [`IntrinsicHeight` por linha] → mede só dois cards por linha e a lista é preguiçosa.
- [Lista curta não rola e não dispararia a próxima página] → a checagem pós-frame cobre.
