> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-catalog`, `mobile/mobile-home`, `mobile/mobile-navigation`, `mobile/mobile-design-system` e `mobile/mobile-architecture` desta change. Referência de comportamento (só leitura): os arquivos do web citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; dependências só por `flutter pub add` (nunca `pub upgrade`); nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Dependência e domínio `catalog`

- [ ] 1.1 Conferir no código as dependências da etapa 4 listadas no design; registrar no `design.md` qualquer nome diferente e seguir com o nome entregue.
- [ ] 1.2 `cd apps/mobile && flutter pub add cached_network_image`; registrar a versão resolvida no `design.md`.
- [ ] 1.3 Criar `lib/modules/catalog/model/category_entity.dart`, `product_summary_entity.dart`, `product_page_entity.dart` e `product_query.dart` (Decisão 1, `freezed` v3) e rodar `dart run build_runner build --delete-conflicting-outputs`; os `.freezed.dart` ficam no repositório.
- [ ] 1.4 Criar `lib/modules/catalog/model/product_query_params.dart` e `home_catalog.dart` (Decisão 1, origem no comentário) e `lib/modules/catalog/provider/catalog_repository.dart`.
- [ ] 1.5 Criar `test/modules/catalog/support/catalog_fixtures.dart`: raízes `artes-pintura` (filhas em destaque `adesivos` e `pinceis-e-trinchas`), `cartuchos-toners` (filha em destaque `toners-hp`, `productCount: 12`) e `escolar` (sem destaque); produtos `finePen` (destaque, 750, sem "De:", sem foto), `brushDuo` (3490/4990, desconto 30, com `thumbUrl`) e `brushSupersoft` (8100/10180, desconto 20), com nomes, slugs e unidades do seed.
- [ ] 1.6 Testes em `test/modules/catalog/model/product_query_params_test.dart`: ida e volta de `ProductQuery(categorySlug: 'escolar', onSale: true, sort: discount, page: 2)` → exatamente `{category, onSale: 'true', sort: 'discount', page: '2'}`; `search` aparado e omitido se vazio; `brandSlugs` vira `brand` com vírgula; `sort=aleatorio`, `page=0`, `featured=1`, `minPriceCents=-5` e `foo=bar` são ignorados; as consultas da Início codificam como a spec.
- [ ] 1.7 Testes em `test/modules/catalog/model/home_catalog_test.dart` e `category_entity_test.dart`: pré-ordem com limite 2 → `adesivos` e `pinceis-e-trinchas` com raiz `artes-pintura`; destaque com `productCount: 0` fica de fora; igualdade por valor; `ProductSort.fromApiValue('price-asc')` e desconhecido → `null`.

## 2. DTOs e repositório

- [ ] 2.1 Criar `test/infra/api/support/storefront_catalog_json.dart`: JSON da árvore e de uma página (`items` com os três produtos das fixtures, `total: 96`, `page: 1`, `pageSize: 8`, `totalPages: 12`, `brandFacets` "Faber-Castell" e "Master"), com os ids das fixtures.
- [ ] 2.2 Criar `lib/infra/api/storefront_category_dto.dart` (Decisão 2) e testes em `test/infra/api/storefront_category_dto_test.dart`: árvore do JSON → fixtures; `parentSlug: null` na raiz; campo extra ignorado; nó sem `slug` e corpo que não é lista lançam.
- [ ] 2.3 Criar `lib/infra/api/storefront_product_dto.dart` (Decisão 2) e testes em `test/infra/api/storefront_product_dto_test.dart`: página do JSON → `ProductPage` com fixtures e facetas; campos nulos (`listPriceCents`, `discountPercent`, `thumbUrl`, `brandName`); `priceCents: -1`, item sem `slug` e corpo sem `items` lançam.
- [ ] 2.4 Criar `lib/infra/catalog/api_catalog_repository.dart` (Decisão 2).
- [ ] 2.5 Testes em `test/infra/catalog/api_catalog_repository_test.dart` com `FakeHttpClientAdapter`: `GET /storefront/categories` sem `Authorization`; segunda chamada sem requisição; `refresh: true` faz nova; falha não guardada; `fetchProducts(homeFeaturedQuery)` manda `featured=true&sort=featured&pageSize=12`; duas chamadas de produtos fazem duas requisições; `200` com `priceCents: -1` → `UnexpectedFailure`; `500` → `ServerFailure`.

## 3. ViewModel da Início, arte das categorias e contagem

- [ ] 3.1 Criar `test/modules/catalog/support/fake_catalog_repository.dart` (Decisão 7).
- [ ] 3.2 Criar `lib/ui/modules/catalog/view_models/block_state.dart` e `home_view_model.dart` (Decisão 3).
- [ ] 3.3 Testes em `test/ui/modules/catalog/view_models/home_view_model_test.dart`: antes de `loadAll`, os três blocos são `BlockLoading`; depois, `BlockLoaded` com as raízes na ordem da API, destaques pedidos com `homeFeaturedQuery` e ofertas com `homeOffersQuery`; `highlighted` com limite 12; `isEverythingEmpty` só com os três vazios.
- [ ] 3.4 Testes de falha e recarga no mesmo arquivo: falha só nas ofertas deixa os outros carregados e `offers` em `BlockFailed`; `loadOffers.execute()` de novo refaz só as ofertas (`categoryCalls` inalterado); `refresh()` chama categorias com `refresh: true` e as duas consultas; durante a recarga o bloco volta a `BlockLoading`.
- [ ] 3.5 Criar `lib/ui/modules/catalog/view_models/category_art.dart` (Decisão 3) e testes em `test/ui/modules/catalog/view_models/category_art_test.dart`: `coffee-break` → ☕/pêssego, `papeis-pastas` → 📄/azul, desconhecida → 🛒/verde.
- [ ] 3.6 Criar `lib/ui/shared/formatters/product_count_formatter.dart` e testes em `test/ui/shared/formatters/product_count_formatter_test.dart`: 1 → "1 produto", 24 → "24 produtos", 0 → "0 produtos".

## 4. Widgets da Início e foto com cache

- [ ] 4.1 Em `lib/ui/shared/widgets/product_art.dart`, trocar `Image.network` por `CachedNetworkImage` (Decisão 6); ajustar o teste "foto que falha cai na reserva" em `test/ui/shared/widgets/product_card_test.dart` para encontrar `CachedNetworkImage` e esperar a reserva; os demais testes do card continuam passando.
- [ ] 4.2 Criar `lib/ui/modules/catalog/widgets/home_hero.dart` e `section_heading.dart` (Decisão 4) com widget tests em `test/ui/modules/catalog/widgets/` (com `themed`): "saindo da Loja Paulista" e, sem loja, "De bike e a pé até você"; "em minutos."; cabeçalho sem ação não mostra "Ver tudo →", com ação chama o callback.
- [ ] 4.3 Criar `category_chips_row.dart` e testes: ordem "Tudo" + raízes, 🖨️ em "Cartuchos & Toners", toque em "Escolar" devolve `ProductQuery(categorySlug: 'escolar')` e em "Tudo" `ProductQuery()`; `loading` mostra nove `SkeletonBox` e nenhum chip.
- [ ] 4.4 Criar `product_rail.dart` e testes: três fixtures → três cards com nome, `R$ 34,90`/`R$ 49,90`, selo `−30%` e "Destaque" no `finePen`; 🎨 de reserva pela raiz; toque chama `onOpenProduct(slug)`; skeleton com `skeletonCount` blocos.
- [ ] 4.5 Criar `highlighted_categories_grid.dart` e testes: "Toners HP" com "12 produtos" e 🖨️; toque chama `onOpenCategory('toners-hp')`; skeleton com seis blocos.
- [ ] 4.6 Criar `home_section.dart` e testes: `BlockLoading` → título + skeleton sem "Ver tudo →"; `BlockFailed` → `StateErrorBanner` com o `errorTitle` e "Tentar de novo" chamando `onRetry` uma vez; `BlockLoaded([])` → nada; `BlockLoaded(itens)` → título, "Ver tudo →" e conteúdo.

## 5. Página, rotas, DI e testes de app

- [ ] 5.1 Reescrever `lib/ui/modules/catalog/pages/home_page.dart` (Decisão 5); a Início deixa de usar `PlaceholderBody`.
- [ ] 5.2 Em `app_routes.dart`, acrescentar `product`, `productLocation(slug)` e `searchLocation(ProductQuery)`; em `app_router.dart`, passar fábricas e callbacks à `HomePage`, a rota filha `product/:slug` com a nova `ProductPage` provisória (`ui/modules/catalog/pages/product_page.dart`) e `SearchPage(initialQuery: decodeProductQuery(state.uri.queryParameters))`.
- [ ] 5.3 Em `service_locator.dart`, registrar `CatalogRepository` (lazy singleton) e `HomeViewModel` em `registerViewModels()`; em `test/infra/di/service_locator_test.dart`, testar o singleton do repositório e a instância nova do ViewModel.
- [ ] 5.4 Em `test/app/support/fake_dependencies.dart`, registrar também o `FakeCatalogRepository`; ajustar `test/app/bootstrap_test.dart` para quatro respostas e conferir os caminhos como conjunto (`/storefront/stores`, `/storefront/categories`, dois `/storefront/products`).
- [ ] 5.5 Testes em `test/app/router/app_router_test.dart`: `/search?category=escolar&sort=aleatorio` seleciona Buscar e a `SearchPage` recebe `ProductQuery(categorySlug: 'escolar')` sem `sort`; `/home/product/caneta-x` mostra "Produto" com a `NavigationBar` visível e voltar retorna à `HomePage`; `AppRoutes.searchLocation(ProductQuery())` é `/search` sem `?`.
- [ ] 5.6 Widget tests em `test/ui/modules/catalog/pages/home_page_test.dart` (fábricas com os dois fakes; remover a expectativa do texto "Início"): tudo carregado mostra chips, "saindo da Loja Paulista", as três seções e os nomes das fixtures; sem ofertas a seção some; skeletons dos três blocos enquanto os `Completer` não completam.
- [ ] 5.7 Testes de falha e vazio na mesma página: falha só nas ofertas mostra "Não foi possível carregar as ofertas." e "Tentar de novo" refaz só as ofertas; falha das categorias mostra um banner só e esconde "Categorias em destaque"; tudo vazio mostra "Nada por aqui. Já já." com "Ver catálogo" chamando `onOpenSearch(ProductQuery())`.
- [ ] 5.8 Testes de navegação e atualização na mesma página: chip "Escolar" e cartão "Toners HP" chamam `onOpenSearch` com a categoria; "Ver tudo →" das ofertas chama com `onSale: true, sort: discount`; toque num card chama `onOpenProduct(slug)`; puxar para baixo (`tester.fling` + `pumpAndSettle`) chama `fetchStores(refresh: true)`, `fetchCategories(refresh: true)` e as duas consultas de novo.

## 6. Barreira (regra F), CLAUDE.md e verificação final

- [ ] 6.1 Em `test/core/support/import_rules.dart`, acrescentar `ImportRule.imagePackageConfinement` (Decisão 6) e, em `architecture_test.dart`, o teste real sobre `lib` exigindo ao menos um arquivo que importe `cached_network_image`, mais os sintéticos: `lib/ui/shared/widgets/x.dart` aceito; `lib/infra/catalog/x.dart` e `lib/app/x.dart` violam.
- [ ] 6.2 Provar que a regra morde: acrescentar temporariamente um import de `cached_network_image` em `lib/infra/catalog/api_catalog_repository.dart`, ver `flutter test test/core/architecture_test.dart` falhar com arquivo e linha, e desfazer.
- [ ] 6.3 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 8 pede, sem apagar regra existente.
- [ ] 6.4 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` do catálogo estão atualizados.
- [ ] 6.5 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [ ] 6.6 `cd apps/mobile && flutter test` com todos os testes passando.
- [ ] 6.7 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
