import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/home_catalog.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/modules/store/model/store_entity.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/modules/catalog/view_models/home_view_model.dart';
import 'package:mobile/ui/modules/catalog/widgets/category_chips_row.dart';
import 'package:mobile/ui/modules/catalog/widgets/highlighted_categories_grid.dart';
import 'package:mobile/ui/modules/catalog/widgets/home_hero.dart';
import 'package:mobile/ui/modules/catalog/widgets/home_section.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_rail.dart';
import 'package:mobile/ui/modules/store/view_models/store_selector_view_model.dart';
import 'package:mobile/ui/modules/store/widgets/store_pill.dart';
import 'package:mobile/ui/modules/store/widgets/store_selector.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_chip.dart';
import 'package:mobile/ui/shared/widgets/empty_state.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';
import '../../../../modules/store/support/fake_store_repository.dart';
import '../../../../modules/store/support/store_fixtures.dart';
import '../../../shared/support/fake_image_loads.dart';

const _networkFailure = NetworkFailure(
  message: 'Não foi possível falar com o servidor. Tente novamente.',
  code: HttpFailureCode.noConnection,
);

const _sheetTitle = 'Comprar na loja';

// A página rola; o viewport de teste cresce para todas as seções serem
// montadas e visíveis sem rolar (a `ListView` só monta o que está à vista).
const _surface = Size(800, 2400);

// O `RefreshIndicator` só arma depois de cerca de um terço da altura da
// rolagem em sobrepasso; o arrasto cresce junto com o viewport.
const _pullToRefresh = Offset(0, 900);

typedef _Fakes = ({FakeStoreRepository store, FakeCatalogRepository catalog});

/// Monta a página como a rota faz: as fábricas criam os ViewModels de verdade
/// sobre os repositórios fake. A página já traz o próprio `Scaffold`. A foto
/// de `brushDuo` fica presa no placeholder (sem rede nem cache do aparelho).
Future<_Fakes> _pumpHome(
  WidgetTester tester, {
  List<Store> stores = const [paulista, rioBranco],
  String? rememberedSlug,
  void Function(FakeStoreRepository repository)? prepareStore,
  void Function(FakeCatalogRepository repository)? prepareCatalog,
  ValueChanged<ProductQuery>? onOpenSearch,
  ValueChanged<String>? onOpenProduct,
}) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  holdImageLoad(brushDuo.thumbUrl!);

  final store = FakeStoreRepository(
    stores: stores,
    rememberedSlug: rememberedSlug,
  );
  final catalog = FakeCatalogRepository();
  prepareStore?.call(store);
  prepareCatalog?.call(catalog);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: HomePage(
        storeSelectorViewModelFactory: () => StoreSelectorViewModel(store),
        homeViewModelFactory: () => HomeViewModel(catalog),
        onOpenSearch: onOpenSearch ?? (_) {},
        onOpenProduct: onOpenProduct ?? (_) {},
      ),
    ),
  );
  return (store: store, catalog: catalog);
}

Finder _section(String title) => find.byWidgetPredicate(
  (widget) => widget is HomeSection<ProductSummary> && widget.title == title,
);

Finder _storeSkeleton() => find.descendant(
  of: find.byType(StoreSelector),
  matching: find.byType(SkeletonBox),
);

void main() {
  group('conteúdo', () {
    testWidgets('com tudo carregado mostra os chips, o hero com a loja, as '
        'três seções e os produtos das fixtures', (tester) async {
      await _pumpHome(
        tester,
        prepareCatalog: (catalog) => catalog
          ..enqueueProducts(Ok(pageOf([finePen, brushSupersoft])))
          ..enqueueProducts(Ok(pageOf([brushDuo]))),
      );
      await tester.pumpAndSettle();

      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Paulista'), findsOneWidget);

      final chips = tester
          .widgetList<AppChip>(
            find.descendant(
              of: find.byType(CategoryChipsRow),
              matching: find.byType(AppChip),
            ),
          )
          .map((chip) => chip.label)
          .toList();
      expect(chips, [
        'Tudo',
        'Artes & Pintura',
        'Cartuchos & Toners',
        'Escolar',
      ]);

      expect(find.byType(HomeHero), findsOneWidget);
      expect(
        find.text(HomeHero.pillWithStore('Loja Paulista')),
        findsOneWidget,
      );

      expect(find.text(HomePage.featuredTitle), findsOneWidget);
      expect(find.text(HomePage.offersTitle), findsOneWidget);
      expect(find.text(HomePage.highlightedTitle), findsOneWidget);
      expect(find.text('Ver tudo →'), findsNWidgets(2));

      expect(find.text(finePen.name), findsOneWidget);
      expect(find.text(brushSupersoft.name), findsOneWidget);
      expect(find.text(brushDuo.name), findsOneWidget);
      expect(find.text('−30%'), findsOneWidget);
      expect(find.byType(ProductCard), findsNWidgets(3));

      expect(find.text('Adesivos Stickers'), findsOneWidget);
      expect(find.text('Pincéis e Trinchas'), findsOneWidget);
      expect(find.text('Toners HP'), findsOneWidget);
      expect(find.text('12 produtos'), findsOneWidget);
      expect(find.byType(StateErrorBanner), findsNothing);
      expect(find.byType(EmptyState), findsNothing);
    });

    testWidgets('sem ofertas, "Ofertas da semana" some e o resto fica', (
      tester,
    ) async {
      await _pumpHome(
        tester,
        prepareCatalog: (catalog) => catalog
          ..enqueueProducts(Ok(pageOf(products)))
          ..enqueueProducts(Ok(pageOf(const []))),
      );
      await tester.pumpAndSettle();

      expect(find.text(HomePage.offersTitle), findsNothing);
      expect(_section(HomePage.offersTitle), findsOneWidget);
      expect(find.text(HomePage.featuredTitle), findsOneWidget);
      expect(find.text(HomePage.highlightedTitle), findsOneWidget);
      expect(find.byType(ProductCard), findsNWidgets(3));
      expect(find.text('Ver tudo →'), findsOneWidget);
    });

    testWidgets('mostra os skeletons dos três blocos enquanto a API não '
        'responde e o conteúdo depois', (tester) async {
      late Completer<Result<List<Category>>> categoriesGate;
      late Completer<Result<ProductPage>> featuredGate;
      late Completer<Result<ProductPage>> offersGate;
      await _pumpHome(
        tester,
        prepareCatalog: (catalog) {
          categoriesGate = catalog.holdCategories();
          featuredGate = catalog.holdProducts();
          offersGate = catalog.holdProducts();
        },
      );
      await tester.pump();

      expect(
        find.descendant(
          of: find.byType(CategoryChipsRow),
          matching: find.byType(SkeletonBox),
        ),
        findsNWidgets(CategoryChipsRow.skeletonCount),
      );
      expect(find.byType(AppChip), findsNothing);
      expect(find.byType(ProductRailSkeleton), findsNWidgets(2));
      expect(find.byType(HighlightedCategoriesGridSkeleton), findsOneWidget);
      expect(find.text(HomePage.featuredTitle), findsOneWidget);
      expect(find.text(HomePage.offersTitle), findsOneWidget);
      expect(find.text(HomePage.highlightedTitle), findsOneWidget);
      expect(find.text('Ver tudo →'), findsNothing);
      expect(find.byType(ProductCard), findsNothing);
      expect(find.byType(EmptyState), findsNothing);

      categoriesGate.complete(const Ok(categoryTree));
      featuredGate.complete(Ok(pageOf([finePen])));
      offersGate.complete(Ok(pageOf([brushDuo])));
      await tester.pumpAndSettle();

      expect(find.byType(ProductRailSkeleton), findsNothing);
      expect(find.byType(HighlightedCategoriesGridSkeleton), findsNothing);
      expect(find.byType(AppChip), findsNWidgets(4));
      expect(find.byType(ProductCard), findsNWidgets(2));
      expect(find.text('Toners HP'), findsOneWidget);
    });
  });

  group('falha e vazio', () {
    testWidgets('falha só nas ofertas mostra o banner delas e "Tentar de '
        'novo" refaz só as ofertas', (tester) async {
      final fakes = await _pumpHome(
        tester,
        prepareCatalog: (catalog) => catalog
          ..enqueueProducts(Ok(pageOf(products)))
          ..enqueueProducts(const Failure(_networkFailure)),
      );
      await tester.pumpAndSettle();

      expect(find.text(HomePage.offersErrorTitle), findsOneWidget);
      expect(find.text(_networkFailure.message), findsOneWidget);
      expect(find.byType(StateErrorBanner), findsOneWidget);
      expect(find.text(HomePage.featuredTitle), findsOneWidget);
      expect(find.text(HomePage.highlightedTitle), findsOneWidget);
      expect(find.byType(ProductCard), findsNWidgets(3));

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(fakes.catalog.productQueries, [
        homeFeaturedQuery,
        homeOffersQuery,
        homeOffersQuery,
      ]);
      expect(fakes.catalog.categoryCalls, [false]);
      expect(fakes.store.fetchCalls, [false]);
      expect(find.byType(StateErrorBanner), findsNothing);
      expect(find.byType(ProductCard), findsNWidgets(6));
    });

    testWidgets('falha das categorias mostra um banner só, na linha de chips, '
        'e esconde "Categorias em destaque"', (tester) async {
      final fakes = await _pumpHome(
        tester,
        prepareCatalog: (catalog) =>
            catalog.enqueueCategories(const Failure(_networkFailure)),
      );
      await tester.pumpAndSettle();

      expect(find.byType(StateErrorBanner), findsOneWidget);
      expect(find.text(HomePage.categoriesErrorTitle), findsOneWidget);
      expect(find.byType(CategoryChipsRow), findsNothing);
      expect(find.text(HomePage.highlightedTitle), findsNothing);
      expect(find.byType(HighlightedCategoriesGrid), findsNothing);
      expect(find.text(HomePage.featuredTitle), findsOneWidget);
      expect(find.text(HomePage.offersTitle), findsOneWidget);
      expect(find.byType(ProductCard), findsNWidgets(6));

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(fakes.catalog.categoryCalls, [false, false]);
      expect(fakes.catalog.productQueries.length, 2);
      expect(find.byType(StateErrorBanner), findsNothing);
      expect(find.byType(CategoryChipsRow), findsOneWidget);
      expect(find.text(HomePage.highlightedTitle), findsOneWidget);
    });

    testWidgets('com tudo vazio mostra "Nada por aqui. Já já." e "Ver '
        'catálogo" abre a Buscar sem filtros', (tester) async {
      final opened = <ProductQuery>[];
      await _pumpHome(
        tester,
        onOpenSearch: opened.add,
        prepareCatalog: (catalog) => catalog
          ..categories = []
          ..products = [],
      );
      await tester.pumpAndSettle();

      expect(find.text(HomePage.emptyTitle), findsOneWidget);
      expect(find.text(HomePage.emptyMessage), findsOneWidget);
      expect(find.byType(HomeHero), findsOneWidget);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.byType(CategoryChipsRow), findsNothing);
      expect(find.byType(HomeSection<ProductSummary>), findsNothing);
      expect(find.text(HomePage.featuredTitle), findsNothing);
      expect(find.text(HomePage.offersTitle), findsNothing);
      expect(find.text(HomePage.highlightedTitle), findsNothing);
      expect(find.byType(StateErrorBanner), findsNothing);

      await tester.tap(find.text(HomePage.emptyAction));
      expect(opened, [const ProductQuery()]);
    });
  });

  group('navegação e atualização', () {
    testWidgets('chip "Escolar" e cartão "Toners HP" abrem a Buscar filtrada '
        'pela categoria', (tester) async {
      final opened = <ProductQuery>[];
      await _pumpHome(tester, onOpenSearch: opened.add);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Escolar'));
      await tester.tap(find.text('Toners HP'));

      expect(opened, [
        const ProductQuery(categorySlug: 'escolar'),
        const ProductQuery(categorySlug: 'toners-hp'),
      ]);
    });

    testWidgets('"Tudo" abre a Buscar sem filtros e "Ver tudo →" das seções '
        'abre com destaques ou com ofertas por desconto', (tester) async {
      final opened = <ProductQuery>[];
      await _pumpHome(tester, onOpenSearch: opened.add);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Tudo'));
      await tester.tap(
        find.descendant(
          of: _section(HomePage.featuredTitle),
          matching: find.text('Ver tudo →'),
        ),
      );
      await tester.tap(
        find.descendant(
          of: _section(HomePage.offersTitle),
          matching: find.text('Ver tudo →'),
        ),
      );

      expect(opened, [
        const ProductQuery(),
        const ProductQuery(featured: true),
        const ProductQuery(onSale: true, sort: ProductSort.discount),
      ]);
    });

    testWidgets('toque num card abre o produto pelo slug', (tester) async {
      final opened = <String>[];
      await _pumpHome(tester, onOpenProduct: opened.add);
      await tester.pumpAndSettle();

      await tester.tap(find.text(finePen.name).first);

      expect(opened, [finePen.slug]);
    });

    testWidgets('puxar para baixo refaz as lojas, as categorias sem '
        'reaproveitar e as duas consultas de produtos', (tester) async {
      final fakes = await _pumpHome(tester);
      await tester.pumpAndSettle();
      expect(fakes.store.fetchCalls, [false]);
      expect(fakes.catalog.categoryCalls, [false]);
      expect(fakes.catalog.productQueries, [
        homeFeaturedQuery,
        homeOffersQuery,
      ]);

      await tester.fling(find.byType(ListView), _pullToRefresh, 1000);
      await tester.pumpAndSettle();

      expect(fakes.store.fetchCalls, [false, true]);
      expect(fakes.catalog.categoryCalls, [false, true]);
      expect(fakes.catalog.productQueries, [
        homeFeaturedQuery,
        homeOffersQuery,
        homeFeaturedQuery,
        homeOffersQuery,
      ]);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.byType(ProductCard), findsNWidgets(6));
      expect(find.byType(RefreshProgressIndicator), findsNothing);
    });
  });

  group('estados do seletor', () {
    testWidgets('mostra o skeleton enquanto a API não responde e a pílula '
        'depois', (tester) async {
      late Completer<Result<List<Store>>> gate;
      await _pumpHome(
        tester,
        prepareStore: (repository) => gate = repository.hold(),
      );
      await tester.pump();

      expect(_storeSkeleton(), findsOneWidget);
      expect(find.byType(StorePill), findsNothing);
      expect(find.text('Loja Paulista'), findsNothing);
      expect(find.text(HomeHero.pillWithoutStore), findsOneWidget);

      gate.complete(const Ok([paulista, rioBranco]));
      await tester.pumpAndSettle();

      expect(_storeSkeleton(), findsNothing);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Paulista'), findsOneWidget);
      expect(find.text('São Paulo/SP'), findsOneWidget);
      expect(
        find.text(HomeHero.pillWithStore('Loja Paulista')),
        findsOneWidget,
      );
    });

    testWidgets('em falha de rede mostra o banner e "Tentar de novo" leva à '
        'pílula', (tester) async {
      final fakes = await _pumpHome(
        tester,
        prepareStore: (repository) =>
            repository.enqueue(const Failure(_networkFailure)),
      );
      await tester.pumpAndSettle();

      expect(find.text(StoreSelector.errorTitle), findsOneWidget);
      expect(find.text(_networkFailure.message), findsOneWidget);
      expect(find.byType(StorePill), findsNothing);

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(fakes.store.fetchCalls, [false, true]);
      // O "Tentar de novo" das lojas não toca no catálogo.
      expect(fakes.catalog.categoryCalls, [false]);
      expect(find.text(StoreSelector.errorTitle), findsNothing);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Paulista'), findsOneWidget);
    });

    testWidgets('sem loja ativa mostra o vazio e "Atualizar" busca de novo sem '
        'reaproveitar', (tester) async {
      final fakes = await _pumpHome(tester, stores: const []);
      await tester.pumpAndSettle();

      expect(find.text(StoreSelector.emptyTitle), findsOneWidget);
      expect(find.text(StoreSelector.emptyMessage), findsOneWidget);
      expect(find.byType(StorePill), findsNothing);

      await tester.tap(find.text(StoreSelector.emptyAction));
      await tester.pumpAndSettle();

      expect(fakes.store.fetchCalls, [false, true]);
      expect(find.text(StoreSelector.emptyTitle), findsOneWidget);
    });
  });

  group('troca de loja', () {
    testWidgets('tocar na pílula e escolher Rio Branco fecha o painel, troca a '
        'pílula, o hero e lembra o slug', (tester) async {
      final fakes = await _pumpHome(tester);
      await tester.pumpAndSettle();
      expect(find.text('Loja Paulista'), findsOneWidget);

      await tester.tap(find.byType(StorePill));
      await tester.pumpAndSettle();

      expect(find.text(_sheetTitle), findsOneWidget);
      expect(
        find.ancestor(
          of: find.byIcon(Icons.check),
          matching: find.widgetWithText(ListTile, 'Loja Paulista'),
        ),
        findsOneWidget,
      );

      await tester.tap(find.widgetWithText(ListTile, 'Loja Rio Branco'));
      await tester.pumpAndSettle();

      expect(find.text(_sheetTitle), findsNothing);
      expect(find.byType(StorePill), findsOneWidget);
      expect(find.text('Loja Rio Branco'), findsOneWidget);
      expect(find.text('Rio de Janeiro/RJ'), findsOneWidget);
      expect(find.text('Loja Paulista'), findsNothing);
      expect(
        find.text(HomeHero.pillWithStore('Loja Rio Branco')),
        findsOneWidget,
      );
      expect(fakes.store.rememberCalls, ['loja-rio-branco']);
      expect(fakes.store.rememberedSlug, 'loja-rio-branco');
      // A troca não vai à API: nenhuma requisição além da carga inicial.
      expect(fakes.store.fetchCalls, [false]);
      expect(fakes.catalog.categoryCalls, [false]);
    });

    testWidgets('com uma loja só, tocar na pílula não abre o painel', (
      tester,
    ) async {
      final fakes = await _pumpHome(tester, stores: const [paulista]);
      await tester.pumpAndSettle();

      expect(find.text('Loja Paulista'), findsOneWidget);
      expect(find.byIcon(Icons.expand_more), findsNothing);

      await tester.tap(find.byType(StorePill));
      await tester.pumpAndSettle();

      expect(find.text(_sheetTitle), findsNothing);
      expect(find.byType(ListTile), findsNothing);
      expect(fakes.store.rememberCalls, isEmpty);
    });

    testWidgets('com a lembrança loja-rio-branco abre já em Rio Branco', (
      tester,
    ) async {
      final fakes = await _pumpHome(tester, rememberedSlug: 'loja-rio-branco');
      await tester.pumpAndSettle();

      expect(find.text('Loja Rio Branco'), findsOneWidget);
      expect(find.text('Rio de Janeiro/RJ'), findsOneWidget);
      expect(find.text('Loja Paulista'), findsNothing);
      // Abrir com a lembrança não grava nada de novo.
      expect(fakes.store.rememberCalls, isEmpty);
    });
  });
}
