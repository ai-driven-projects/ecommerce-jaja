## Context

As etapas 1 a 5 (arquivadas) deixaram o domínio `catalog` (`ProductSummary`, `ProductQuery`, `encodeProductQuery`, `CatalogRepository` com `fetchCategories`/`fetchProducts`), o `ApiCatalogRepository` sobre `runRequest` (que já converte `404` em `NotFoundFailure`), o `BlockState<T>`, o `categoryArtOf`, o `SectionHeading`, o `ProductRail`, o `ProductArt` (só no tamanho do card, altura 120), o `PriceText`, o `AppButton` (tamanho `xl`), o `StateErrorBanner`, o `EmptyState` e o `SkeletonBox`. A etapa 6 (em aplicação) entrega a Buscar real e a rota de produto também na pilha da Buscar. As duas rotas de produto ainda montam o widget provisório `ProductPage({slug, onBack})`, homônimo da entidade `ProductPage` (página de produtos).

Referência de comportamento (só leitura): `apps/frontend/src/app/(public)/p/[slug]/page.tsx`, `modules/catalog/pages/product.page.tsx`, `components/{product-detail,product-gallery}.component.tsx` e o mockup `openspec/extras/design/Produto.dc.html`. Contrato: `StorefrontController.findProductBySlug` (`404` com `PRODUCT_NOT_FOUND`) e `StorefrontProductDetailDTO`/`ProductImageDTO` em `modules/catalog/src/product/dto/`.

## Goals / Non-Goals

**Goals:** entidade, DTO e leitura do detalhe; página do produto completa nas duas pilhas, com galeria, descrição recolhível, ficha, "Mais de <categoria>", os estados uniformes e a ação principal visível; o widget provisório some.

**Non-Goals (ficam para outras etapas):**
- Quantidade (stepper 1 a 99), "Adicionar · R$ total", aviso "Adicionado ao carrinho", "Você já tem N no carrinho" e o cartão de entrega (frete grátis e taxa vêm de `modules/orders/src/cart`) — etapa 9, junto com o domínio `cart`; aqui o botão nasce desabilitado.
- Badge da aba Carrinho e "+" no card — etapa 9.
- Varredura de textos repetidos e testes finais de DI/rotas — etapa 15.
- "← Voltar aos resultados" do web: no app o botão de voltar da pilha já devolve à listagem com o estado dela; não entra em etapa nenhuma.
- Selo "Chega em ~25 min", "Em estoque no hub" e ficha técnica do mockup: dados que a API não tem; não entram (a spec web proíbe dados inventados).

## Decisions

### 1. Domínio (`lib/modules/catalog/`)
- `model/product_detail_entity.dart` (`freezed` v3): `ProductDetail` (`id`, `slug`, `name`, `String? sku`, `String? description`, `Money price`, `Money? listPrice`, `int? discountPercent`, `unit`, `isFeatured`, `CatalogRef? brand`, `List<CatalogRef> categories`, `List<ProductImage> images`), `CatalogRef` (`slug`, `name`) e `ProductImage` (`thumbUrl`, `largeUrl`, `order`). Listas obrigatórias, sem `@Default`, como `Category.children`.
- `model/product_detail.dart` (Dart puro, origem `product-detail.component.tsx` no comentário): `relatedProductsLimit = 4`; `relatedProductsQuery(ProductDetail) → ProductQuery?` (`categorySlug` da última categoria, `sort: featured`, `pageSize: 5`; `null` sem categorias); `relatedProducts(List<ProductSummary>, String productId)` (sem o próprio, no máximo 4); `rootCategorySlugOf(ProductDetail)` (slug da primeira categoria, ou `''`, que cai na reserva 🛒 do `categoryArtOf`).
- `CatalogRepository` ganha `Future<Result<ProductDetail>> fetchProduct(String slug)`. Sem use case (regra 4): uma leitura só.

### 2. DTO e repositório
- `lib/infra/api/storefront_product_detail_dto.dart`: `parseStorefrontProductDetail(Object?)` no molde de `storefront_product_dto.dart` (casts estritos, `Money.fromCents` com `Failure` → `FormatException` com o nome do campo, campos extras ignorados). `brand` aceita `null`; `categories` mantém a ordem recebida; `images` é ordenada por `order` no `toEntity()` (a API já ordena; o app não depende disso). Listas `List.unmodifiable`.
- `ApiCatalogRepository.fetchProduct`: `GET '/storefront/products/${Uri.encodeComponent(slug)}'` via `runRequest`, nunca guardado. `404` já vira `NotFoundFailure` pelo mapeador; o código `PRODUCT_NOT_FOUND` não é conferido (no web só esse `404` existe nessa rota).

### 3. `ProductDetailViewModel` (`lib/ui/modules/catalog/view_models/`)
- `ProductDetailViewModel(CatalogRepository)`, `registerFactory`. `start(String slug)` guarda o slug e executa `load` (`Command0<void>`); "Tentar de novo" é `load.execute()`.
- `product: BlockState<ProductDetail>` por getter, como a `HomeViewModel`: `BlockLoading` enquanto `load` roda, senão o último resultado. `isNotFound`: `BlockFailed` com `NotFoundFailure`.
- `related: List<ProductSummary>`: vazio até chegar. Depois de um `Ok` do produto, o ViewModel pede `relatedProductsQuery` sem esperar (a página aparece antes) e guarda `relatedProducts(...)`; falha deixa vazio, sem banner (a seção do web some sem itens). Sem categoria, não pede. Uma nova execução de `load` limpa `related`.
- Sem estado de galeria nem de descrição: são estado de widget (`StatefulWidget`), não de tela.

### 4. Página e widgets (`lib/ui/modules/catalog/`)
- `pages/product_detail_page.dart`: `ProductDetailPage({slug, productDetailViewModelFactory, onBack, onOpenSearch(ProductQuery), onOpenProduct(String slug), VoidCallback? onAddToCart})`, `WatchingStatefulWidget` no molde da `HomePage` (fábrica no `initState`, `dispose` do ViewModel). O arquivo `pages/product_page.dart` e o widget provisório `ProductPage` são apagados: o nome novo acaba com a homonímia com a entidade.
- `Scaffold` com `AppBar(leading: BackButton(onPressed: onBack))`, sem título (o nome aparece no corpo), em todos os estados. Corpo: `ListView` (padding 16) com galeria, selos, marca, nome, "unidade · Cód. sku", preço, trilha, descrição, ficha e "Mais de <categoria>"; espaço de 16 entre blocos e 24 antes das seções. `bottomNavigationBar` só com o produto carregado: `SafeArea` com borda superior `line`, fundo `card`, padding 16 e `AppButton(label: 'Adicionar ao carrinho', size: xl, expand: true, icon: Icons.shopping_bag_outlined, onPressed: onAddToCart)`.
- Estados: skeleton (`SkeletonBox` quadrado de raio `xl4` mais barras do nome, da unidade e do preço, anunciado uma vez como "Carregando"); `isNotFound` → `EmptyState(emoji: '🔎', title: 'Produto não encontrado', message: 'Ele pode ter saído do catálogo.', actionLabel: 'Voltar ao catálogo')` → `onOpenSearch(const ProductQuery())`; outra falha → `StateErrorBanner(title: 'Não foi possível carregar o produto.', onRetry: load.execute)`. Textos como constantes públicas da página.
- `widgets/product_gallery.dart` (`StatefulWidget`, chave pelo slug): `AspectRatio(1)` com `PageView.builder` de `ProductArt(size: gallery, imageUrl: largeUrl, emoji/tint de categoryArtOf(root))`. Com 2+ imagens: contador "n/total" em pílula `card` no canto inferior direito (`chipCount`, `Semantics(liveRegion)`), e faixa horizontal de miniaturas 72×72 (`ProductArt(size: thumb, imageUrl: thumbUrl)`, borda 2 `brand` na ativa, transparente nas outras, raio `xl`, padding 4: o `rounded-xl border-2 p-1` do web), cada uma `Semantics(button, selected, label: 'Imagem n de total')`; tocar anima a `PageController` (250 ms) e `onPageChanged` atualiza o índice e rola a faixa até a miniatura (`Scrollable.ensureVisible`). Sem setas: deslizar é o gesto de app. Sem imagens: um `ProductArt(size: gallery)` sem URL.
- `ProductArt` ganha `ProductArtSize { card, gallery, thumb }` (padrão `card`, comportamento atual intacto): `card` mantém a altura 120 e o raio `xl`; `gallery` e `thumb` preenchem o pai, com raio `xl4` e `lg` (o `rounded-4xl` e o `rounded-lg` do web); emoji `artEmoji`, `artEmojiLarge` (96) e `artEmojiThumb` (26, o `text-[26px]` do web). Respiro da foto de 8 em todos.
- `ProductBadge`: o `_Badge` privado do `ProductCard` sobe para `lib/ui/shared/widgets/product_badge.dart` (segundo consumidor), com as mesmas cores; o card passa a usá-lo sem mudar de aparência. A página mostra "Em destaque" (variante da marca) e `−N%` (variante sólida) lado a lado, nessa ordem, como o web (no card continua um selo só).
- `widgets/product_description.dart` (`StatefulWidget`): título "Sobre o produto" (`AppTextStyles.sectionSmall`, Bricolage 17/700), texto em `descriptionBody` (14,5, altura 1,65, `inkSoft`); acima de `collapseLength = 600` caracteres, `maxLines: 8` com reticências e `TextButton` "Ler mais"/"Ler menos" (`Semantics(expanded)`).
- `widgets/product_specs.dart`: ficha em coluna, uma linha por item em fundo `surface`, raio `md`, padding 13×9, "Rótulo" em `mutedInk` + " · " + valor em negrito, `bodyMedium` 13,5.
- `widgets/category_trail.dart`: `Wrap` de links (`titleSmall` em `brand`, alvo de toque mínimo 44 via `InkWell` com padding) separados por "/" em `mutedInk`; tocar chama `onOpenSearch(ProductQuery(categorySlug:))`. A marca é um link igual acima do nome → `onOpenSearch(ProductQuery(brandSlugs: [slug]))`.
- "Mais de <categoria>": `SectionHeading` sem "Ver tudo" + `ProductRail(cardWidth: ProductRail.featuredCardWidth)`, só com `related` não vazio; toque → `onOpenProduct(slug)`.
- Tipografia nova em `AppTextStyles` (a regra C proíbe estilo literal nos widgets): `productTitle` (Bricolage 26/800, altura 1,15, o `h1` do web em telas pequenas), `priceLarge` (Bricolage 34/800 tabular, o preço do detalhe), `sectionSmall`, `descriptionBody`, `artEmojiLarge`, `artEmojiThumb`. O `PriceText` recebe `style: priceLarge`.

### 5. Rotas e DI
- As rotas filhas `product/:slug` de `/home` e de `/search` passam a montar `ProductDetailPage` com `productDetailViewModelFactory: () => getIt<ProductDetailViewModel>()`, `onBack: context.pop`, `onOpenSearch: (q) => context.go(AppRoutes.searchLocation(q))`, `onAddToCart: null` e `onOpenProduct` empilhando na mesma aba (`AppRoutes.productLocation` na Início, `searchProductLocation` na Buscar). Os caminhos não mudam.
- `registerViewModels()` ganha `ProductDetailViewModel`. Nenhum pacote novo nem pasta nova de camada: a barreira não muda.

### 6. Testes e fakes
- `catalog_fixtures.dart` ganha `tonerDetail` (raiz `cartuchos-toners` › `toners-hp`, marca HP, `sku`, descrição de 700 caracteres, destaque, desconto 30, 3490/4990, três imagens com URLs fixas) e `plainDetail` (sem marca, `sku`, descrição nem imagens). `FakeCatalogRepository` ganha fila de produto (`enqueueProduct`, `holdProduct()`, `productSlugs`) com padrão `plainDetail`; `registerFakeDependencies` não muda além disso.
- Todo teste que monta a galeria de `tonerDetail` chama `holdImageLoad` (ou `failImageLoad`) para as três `largeUrl` e as três `thumbUrl` antes do `pumpWidget`, pelo motivo registrado na etapa 5 (o cache do aparelho não existe no `flutter_test`).
- `test/infra/api/support/storefront_product_detail_json.dart`: JSON de exemplo com imagens fora de ordem, campo extra e as variantes nulas.

### 7. `CLAUDE.md`
Só acréscimos: "Etapa 7" no estado atual; em "Regras de domínio › Catálogo", o detalhe (nunca guardado, `404` vira estado vazio, relacionados sem banner) e o botão do carrinho desabilitado até a etapa 9; na lista do tema, `ProductArtSize` e `ProductBadge`.

## Dependências da etapa anterior

Assumido da change `mobile-app-06-busca-catalogo-mobile` (conferir antes do lote 1; se algo mudou, adaptar sem renomear o que existe e registrar abaixo):
- `AppRoutes.searchProduct`, `searchProductSegment` e `searchProductLocation(slug)`, e a rota filha de `/search` montando o `ProductPage({slug, onBack})` provisório com `onBack: context.pop`.
- `SearchPage` aplica um `initialQuery` novo no `didUpdateWidget` (o `context.go(searchLocation(q))` vindo do produto chega por aí) e `go('/search')` sem query limpa os filtros.
- `ProductRail` continua com `featuredCardWidth` e monta os cards por `product_summary_card.dart`; `SectionHeading(title, onSeeAll?)` intacto.
- `FakeCatalogRepository` com `pageOf` de parâmetros nomeados opcionais e `manyProducts` nas fixtures; `SearchViewModel` em `registerViewModels()`.
- Testes de rota da etapa 6 que esperam a página provisória "Produto" (`app_router_test.dart`, tarefas 5.4 dela e da etapa 5): passam a esperar a `ProductDetailPage`.
- Da etapa 5 (já conferido no código): `BlockState`, `categoryArtOf`, `ProductArt`/`ProductArtTint`, `_Badge` privado no `ProductCard`, `PriceText(style:)`, `AppButton(size: AppButtonSize.xl, expand:, icon:)`, `EmptyState(emoji:)`, `StateErrorBanner(title:)`, `AppRadius.{md, lg, xl, xl4}`, `AppTextStyles.{artEmoji, chipCount}`, `holdImageLoad`/`failImageLoad`, `runRequest` com `404` → `NotFoundFailure`, `FakeHttpClientAdapter`.

## Decisões tomadas sem consulta

- Botão "Adicionar ao carrinho" visível e **desabilitado** (`onAddToCart: null`) até a etapa 9, em vez de um toque que não faz nada ou de um aviso "em breve".
- Sem stepper de quantidade, total da linha e cartão de entrega nesta etapa: dependem do carrinho e das regras de frete (etapa 9).
- "Mais de <categoria>" entra (faz parte da página do web), em trilho horizontal como a Início; falha some em silêncio, como no web.
- Galeria por deslize com contador e miniaturas, sem as setas "anterior/próxima" do web (padrão de app); emoji da galeria em 96 (o mockup usa 120 numa área de 380 de altura; a tela do celular é mais estreita).
- Trilha de categorias abaixo do preço, como links para a Buscar filtrada; não há "Início" na trilha (a aba Início já está na barra).
- Marca como link para a Buscar filtrada pela marca, como o web.
- `404` vira o estado vazio "Produto não encontrado" com "Voltar ao catálogo" abrindo a Buscar sem filtros (o plano pede "voltar ao catálogo"); o texto da mensagem é novo (o web mostra a página 404 genérica).
- O widget provisório `ProductPage` é apagado e substituído por `ProductDetailPage`, acabando com a homonímia com a entidade `ProductPage`.
- `_Badge` do card sobe para `shared/widgets/product_badge.dart` por ter o segundo consumidor.
- Nenhuma lacuna de API encontrada: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [Galeria com fotos nos testes aciona o cache do aparelho] → `holdImageLoad`/`failImageLoad` para cada URL; o fake padrão usa `plainDetail`, sem fotos.
- [`ProductArt` com três tamanhos fica mais complexo] → o tamanho `card` continua o padrão e os testes do card não mudam.
- [Segunda requisição (relacionados) a cada produto aberto] → é a mesma do web; pequena (`pageSize=5`) e não bloqueia a página.
- [A etapa 6 mudar nomes de rota ou do fake] → a seção "Dependências da etapa anterior" lista o que conferir; o lote 1 começa por ela.
