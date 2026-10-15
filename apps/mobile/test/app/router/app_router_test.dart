import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/router/app_router.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';
import 'package:mobile/ui/modules/cart/pages/cart_page.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/modules/catalog/pages/product_page.dart';
import 'package:mobile/ui/modules/catalog/pages/search_page.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';
import 'package:mobile/ui/modules/catalog/widgets/filters_sheet.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_grid.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';

import '../../modules/catalog/support/catalog_fixtures.dart';
import '../../modules/catalog/support/fake_catalog_repository.dart';
import '../support/fake_dependencies.dart';

Future<GoRouter> _pumpRouter(
  WidgetTester tester, {
  String initialLocation = AppRoutes.home,
}) async {
  final router = buildAppRouter(initialLocation: initialLocation);
  addTearDown(router.dispose);
  await tester.pumpWidget(
    MaterialApp.router(routerConfig: router, theme: AppTheme.light()),
  );
  await tester.pumpAndSettle();
  return router;
}

String _location(GoRouter router) =>
    router.routerDelegate.currentConfiguration.uri.path;

/// Caminho e query da localização atual, como a aba a guarda.
String _fullLocation(GoRouter router) =>
    router.routerDelegate.currentConfiguration.uri.toString();

NavigationBar _bar(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar));

FakeCatalogRepository get _catalog =>
    getIt<CatalogRepository>() as FakeCatalogRepository;

/// Troca o `registerFactory` do [SearchViewModel] por um que conta as
/// chamadas, para provar que trocar o filtro não recria o ViewModel.
List<SearchViewModel> _countSearchViewModels() {
  final created = <SearchViewModel>[];
  getIt.unregister<SearchViewModel>();
  getIt.registerFactory<SearchViewModel>(() {
    final viewModel = SearchViewModel(getIt<CatalogRepository>());
    created.add(viewModel);
    return viewModel;
  });
  return created;
}

Future<void> _tapTab(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label)),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(registerFakeDependencies);
  tearDown(resetDependencies);

  group('abas', () {
    testWidgets('a barra mostra Início, Buscar, Carrinho e Conta, com Início '
        'selecionada', (tester) async {
      await _pumpRouter(tester);

      final bar = _bar(tester);
      final labels = bar.destinations
          .map((destination) => (destination as NavigationDestination).label)
          .toList();
      expect(labels, ['Início', 'Buscar', 'Carrinho', 'Conta']);
      expect(bar.selectedIndex, 0);
      expect(find.byType(HomePage), findsOneWidget);
    });

    testWidgets('tocar em Carrinho mostra o carrinho e mantém o Início montado '
        'fora da tela', (tester) async {
      final router = await _pumpRouter(tester);

      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Carrinho'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(CartPage), findsOneWidget);
      expect(find.byType(HomePage), findsNothing);
      expect(find.byType(HomePage, skipOffstage: false), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_location(router), AppRoutes.cart);
    });

    testWidgets('/ vai para /home', (tester) async {
      final router = await _pumpRouter(tester, initialLocation: '/');

      expect(_location(router), AppRoutes.home);
      expect(find.byType(HomePage), findsOneWidget);
    });
  });

  group('rotas do catálogo', () {
    testWidgets('/search?category=escolar&sort=aleatorio seleciona Buscar e '
        'entrega o filtro decodificado, sem a ordem inválida', (tester) async {
      await _pumpRouter(
        tester,
        initialLocation: '/search?category=escolar&sort=aleatorio',
      );

      expect(_bar(tester).selectedIndex, 1);
      final page = tester.widget<SearchPage>(find.byType(SearchPage));
      expect(page.initialQuery, const ProductQuery(categorySlug: 'escolar'));
      expect(page.initialQuery.sort, isNull);
      expect(encodeProductQuery(_catalog.productQueries.last), {
        'category': 'escolar',
        'page': '1',
        'pageSize': '24',
      });
    });

    testWidgets('marcar "Só ofertas" espelha o filtro na rota sem recriar o '
        'ViewModel, e voltar à aba depois da Início não pede de novo', (
      tester,
    ) async {
      final created = _countSearchViewModels();
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.search,
      );

      await tester.tap(find.text(SearchPage.filtersLabel));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text(FiltersSheet.onSaleLabel));
      await tester.pumpAndSettle();
      await tester.tap(find.text(FiltersSheet.onSaleLabel));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip(FiltersSheet.closeTooltip));
      await tester.pumpAndSettle();

      expect(_fullLocation(router), '/search?onSale=true');
      expect(created, hasLength(1));
      expect(
        tester.widget<SearchPage>(find.byType(SearchPage)).initialQuery,
        const ProductQuery(onSale: true),
      );

      await _tapTab(tester, 'Início');
      expect(find.byType(HomePage), findsOneWidget);
      final requests = _catalog.productQueries.length;

      await _tapTab(tester, 'Buscar');

      expect(_bar(tester).selectedIndex, 1);
      expect(_fullLocation(router), '/search?onSale=true');
      expect(find.text('Filtros (1)'), findsOneWidget);
      expect(_catalog.productQueries, hasLength(requests));
      expect(created, hasLength(1));
    });

    testWidgets('/home/product/caneta-x mostra "Produto" sobre a Início, com '
        'a barra de abas visível, e voltar retorna à Início', (tester) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.productLocation('caneta-x'),
      );

      expect(_location(router), '/home/product/caneta-x');
      final page = tester.widget<ProductPage>(find.byType(ProductPage));
      expect(page.slug, 'caneta-x');
      expect(find.text('Produto'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 0);
      expect(find.byType(HomePage), findsNothing);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(ProductPage), findsNothing);
      expect(find.byType(HomePage), findsOneWidget);
      expect(_location(router), AppRoutes.home);
    });

    testWidgets('tocar num card da Início abre o produto na pilha da aba', (
      tester,
    ) async {
      final router = await _pumpRouter(tester);

      await tester.ensureVisible(find.byType(ProductCard).first);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(ProductCard).first);
      await tester.pumpAndSettle();

      final page = tester.widget<ProductPage>(find.byType(ProductPage));
      expect(page.slug, finePen.slug);
      expect(find.byType(NavigationBar), findsOneWidget);
      // `push` não muda a localização "ida" do router; o que conta é a pilha.
      expect(_location(router), AppRoutes.home);
    });

    testWidgets('tocar num card da Buscar abre "Produto" na pilha da aba, e '
        'voltar mostra a mesma listagem sem nova requisição', (tester) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.search,
      );
      final listed = tester
          .widget<ProductGrid>(find.byType(ProductGrid))
          .products;
      final requests = _catalog.productQueries.length;

      await tester.tap(find.byType(ProductCard).first);
      await tester.pumpAndSettle();

      final page = tester.widget<ProductPage>(find.byType(ProductPage));
      expect(page.slug, listed.first.slug);
      expect(find.text('Produto'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 1);
      expect(find.byType(SearchPage), findsNothing);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(ProductPage), findsNothing);
      expect(find.byType(SearchPage), findsOneWidget);
      expect(
        tester.widget<ProductGrid>(find.byType(ProductGrid)).products,
        listed,
      );
      expect(_catalog.productQueries, hasLength(requests));
      expect(_location(router), AppRoutes.search);
    });
  });

  group('AppRoutes', () {
    test('searchLocation sem filtros é /search, sem "?"', () {
      expect(AppRoutes.searchLocation(const ProductQuery()), '/search');
    });

    test('searchLocation codifica os filtros com os nomes da API', () {
      expect(
        AppRoutes.searchLocation(
          const ProductQuery(onSale: true, sort: ProductSort.discount),
        ),
        '/search?onSale=true&sort=discount',
      );
      expect(
        AppRoutes.searchLocation(const ProductQuery(categorySlug: 'escolar')),
        '/search?category=escolar',
      );
    });

    test('productLocation monta o caminho do produto pelo slug', () {
      expect(AppRoutes.productLocation('caneta-x'), '/home/product/caneta-x');
      expect(AppRoutes.product, '/home/product/:slug');
    });

    test('searchProductLocation monta o produto na pilha da Buscar e codifica '
        'o slug', () {
      expect(
        AppRoutes.searchProductLocation('caneta x'),
        '/search/product/caneta%20x',
      );
      expect(AppRoutes.searchProduct, '/search/product/:slug');
    });
  });

  group('rota desconhecida', () {
    testWidgets('mostra "Página não encontrada" e volta ao Início', (
      tester,
    ) async {
      final router = await _pumpRouter(tester, initialLocation: '/nao-existe');

      expect(find.text('Página não encontrada'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);

      await tester.tap(find.text('Voltar ao início'));
      await tester.pumpAndSettle();

      expect(find.byType(HomePage), findsOneWidget);
      expect(_location(router), AppRoutes.home);
    });
  });
}
