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
- Lote 1: dependências da etapa 5 conferidas no código, todas com o nome do design. Para importar: `Category` está em `lib/modules/catalog/model/category_entity.dart`, `ProductPage`/`BrandFacet` (entidades) em `product_page_entity.dart` e `ProductSummary` em `product_summary_entity.dart`; a página provisória de produto também se chama `ProductPage` (`lib/ui/modules/catalog/pages/product_page.dart`), então quem usar as duas importa uma delas com prefixo ou `hide`.
- Lote 2: `applyQuery` com filtro igual ao em vigor não faz nada, nem cancela a espera da busca nem mexe no campo: o `go` que espelha o filtro na rota volta pelo `didUpdateWidget` com o mesmo filtro e não pode apagar o que a pessoa já digitou depois.
- Lote 2: o "Tentar de novo" do rodapé é `retryLoadMore()` (limpa `loadMoreFailure` e executa `loadMore`); o da grade é `retry()` (página 1, nova geração). `loadMore.execute()` com falha pendente não pede nada.
- Lote 2: `start(initial)` sempre pede a página 1 (mesmo com `ProductQuery()` vazia, igual ao valor inicial do `query`) e iguala `searchText` ao termo recebido.
- Lote 2: a página carregada (`hasMore`) é contada pelo número pedido, não pelo `page` da resposta; `total`, `totalPages` e `brandFacets` vêm da resposta.
- Lote 2: um `loadMore` de filtro antigo continua com `running` até a resposta chegar (e ser descartada); enquanto isso `loadingMore` fica ligado e uma nova página seguinte não sai. Aceito: o pedido velho termina logo e a checagem pós-frame da página (lote 4) volta a pedir.
- Lote 2: exceção do repositório na página 1 ou seguinte vira `UnexpectedFailure` ("Algo deu errado. Tente novamente."), como no `Command`; depois do `dispose` nenhuma resposta notifica.
- Lote 2: fixtures — `manyProducts(count, prefix:)` gera `id` `<prefix>-id-<n>`, `slug` `<prefix>-<n>` e nome `Produto <prefix> <n>`; `hpFacet` é `BrandFacet(slug: 'hp', name: 'HP', count: 12)`; `pageOf(items, page:, totalPages:, total:, brandFacets:)` mantém `pageSize = items.length`.
- Lote 3: `ProductGrid` é um sliver (`SliverList.separated` de linhas, para a `CustomScrollView` da página), sem padding próprio (a página põe o `SliverPadding`); `ProductGridSkeleton(count:)` é widget comum (`Column` de linhas, não preguiçoso) — na página entra em `SliverToBoxAdapter`, com `count: 6` na primeira página e `count: 2` no rodapé.
- Lote 3: `ActiveFilterPills` recebe `query`, a `category` resolvida (`vm.filteredCategory`), `brandFacets` e um callback por remoção (`onRemoveCategory`, `onRemoveBrand(slug)`, `onClearPrice`, `onRemoveOnSale`, `onRemoveFeatured`, `onClearFilters`); sem filtro ativo vira `SizedBox.shrink`. O n de "Filtros (n)" sai de `ActiveFilterPills.countOf(query)`; o rótulo de preço, de `ActiveFilterPills.priceLabel`. A pílula é `AppChip(size: sm, selected: true)` com o novo parâmetro opcional `trailingIcon` do `AppChip` (o ícone de fechar), e "Limpar filtros" é `AppButton` `ghost` `sm`.
- Lote 3: `SearchField(controller, onChanged, onSubmitted, onClear)` — o botão só chama `onClear`; quem esvazia o controlador é a página (igualando-o a `vm.searchText` depois de `clearSearch`).
- Lote 3: linha de escolha única compartilhada pelos dois painéis em `widgets/choice_row.dart` (`ChoiceRow`: `ListTile(selected:)` em laranja com cheque, `caption` e `indent`), no molde das linhas do seletor de loja.
- Lote 3: `showSortSheet(context, current: effectiveSort(q), options: listingSorts(q))`; rótulos em `productSortLabels`. O painel usa `isScrollControlled` e rola: seis opções passam da altura padrão do bottom sheet (9/16 da tela).
- Lote 3: no painel de filtros, enquanto `results` está em `BlockLoading` o grupo Marca mostra linhas de skeleton (as facetas são zeradas a cada troca de filtro e "Nenhuma marca neste resultado." piscaria a cada toque); com a listagem em falha, o grupo mostra só as marcas escolhidas (pelo slug) ou o aviso. O rodapé mostra "Ver produtos" em `BlockLoading` e também em `BlockFailed`. Títulos dos grupos com o texto do web ("Categoria", "Marca"…), sem caixa-alta forçada. "Aplicar" é `AppButton` `secondary` `sm` (como diz a Decisão 4; o web usa `outline`). O aviso de preço inválido é um texto só, abaixo dos dois campos, como no web.
- Lote 4: ligação **provisória** da `SearchPage` em `app_router.dart`, só para o projeto compilar entre os lotes: `searchViewModelFactory: () => SearchViewModel(getIt<CatalogRepository>())`, `onQueryChanged` sem efeito e `onOpenProduct` abrindo a rota de produto da Início (`AppRoutes.productLocation`). O lote 5 troca tudo pelo que a Decisão 6 pede (`getIt<SearchViewModel>()`, `context.go(searchLocation)`, `/search/product/:slug`) e remove o import de `catalog_repository.dart` do router.
- Lote 4: no `app_router_test.dart` só saiu a expectativa do `PlaceholderBody` "Buscar" no teste de `/search?category=escolar&sort=aleatorio` (a 4.1 tira o provisório); a 5.3 acrescenta ali o pedido com `category=escolar` e sem `sort`.
- Lote 4: a `SearchPage` não chama `onQueryChanged` na montagem (o filtro inicial veio da rota); chama a cada mudança do `query` depois dela, no pós-quadro, junto com o salto da rolagem ao topo (`ScrollController` da página). O mesmo ouvinte iguala o `TextEditingController` a `vm.searchText` quando diferem e agenda a checagem de "lista curta" (`extentAfter < 600` no pós-quadro); o `NotificationListener` só olha a rolagem vertical de profundidade 0. A página só chama `loadMore.execute()` com `hasMore`, sem `loadingMore` e sem `loadMoreFailure`.
- Lote 4: escolher no painel de ordem a ordem que já vale (a efetiva) não muda o filtro nem pede de novo; sem essa guarda, tocar "Destaques" sem busca gravaria `sort=featured` e recarregaria a mesma listagem.
- Lote 4: botão do painel é "Filtros" sem filtro ativo e "Filtros (n)" com; os dois botões (filtros com `Icons.tune`, ordem com `Icons.swap_vert`) são `AppButton` `outline` `sm`, num `Wrap` acima do título. Título em `headlineSmall` (como a `SectionHeading`), contagem em `bodySmall` `mutedInk`. Grade e rodapé ficam num `SliverMainAxisGroup`; o rodapé mostra o banner de falha antes do skeleton.
- Lote 4: nos testes da página, "rolar até o fim" é `jumpTo(maxScrollExtent)` no `ScrollController` da `CustomScrollView`: um `drag` longo continua pelos itens da página recém-chegada e pede a seguinte, o que é certo na página mas tira o teste do controle.
- Lote 5: a ligação provisória do lote 4 saiu; o router usa `getIt<SearchViewModel>()`, `context.go(AppRoutes.searchLocation(q))` e `context.push(AppRoutes.searchProductLocation(slug))`, e não importa mais o `CatalogRepository`. O `go` para `/search?…` com a página montada manteve o mesmo `State` na versão atual do `go_router` (o teste da fábrica chamada uma vez passa), então o ViewModel continua dentro do `State` da página.
- Lote 5: no `app_router_test.dart`, a contagem da fábrica troca o `registerFactory` do `SearchViewModel` por um que guarda cada instância criada (`getIt.unregister` + `registerFactory`); as requisições são lidas do `FakeCatalogRepository` registrado por `registerFakeDependencies`. "Voltar à aba sem nova requisição" compara a contagem depois de a Início assentar (a Início faz os próprios pedidos ao abrir).
- Lote 5: `test/app/app_test.dart` e `test/app/bootstrap_test.dart` passaram sem ajuste: nenhum deles abre a aba Buscar, e o ramo dela só é montado quando visitado.
- Lote 5: `git status` mostra também `openspec/loops/mobile-app/loop.json` e `openspec/changes/mobile-app-07-detalhe-produto-mobile/`, gravados pelo próprio loop, fora desta change e não alterados por ela. Nenhum desvio do plano nesta etapa.

## Risks / Trade-offs

- [`context.go` a cada mudança de filtro recriar a página] → o teste da fábrica chamada uma vez prova o contrário; se a versão do `go_router` mudar a chave, a página passa a guardar o ViewModel fora do `State` só nesse caso e a decisão é registrada.
- [Muitas requisições ao marcar várias opções seguidas no painel] → cada uma descarta a anterior pela geração; nenhuma resposta velha aparece.
- [`IntrinsicHeight` por linha] → mede só dois cards por linha e a lista é preguiçosa.
- [Lista curta não rola e não dispararia a próxima página] → a checagem pós-frame cobre.
