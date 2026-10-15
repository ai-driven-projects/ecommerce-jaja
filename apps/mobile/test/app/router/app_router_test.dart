import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/router/app_router.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/ui/modules/cart/pages/cart_page.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/modules/catalog/pages/product_page.dart';
import 'package:mobile/ui/modules/catalog/pages/search_page.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/placeholder_body.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';

import '../../modules/catalog/support/catalog_fixtures.dart';
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

NavigationBar _bar(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar));

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
      expect(
        find.descendant(
          of: find.byType(PlaceholderBody),
          matching: find.text('Buscar'),
        ),
        findsOneWidget,
      );
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
