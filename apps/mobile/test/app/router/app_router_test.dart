import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/router/app_router.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/ui/modules/cart/pages/cart_page.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';

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

void main() {
  setUp(registerFakeDependencies);
  tearDown(resetDependencies);

  group('abas', () {
    testWidgets('a barra mostra Início, Buscar, Carrinho e Conta, com Início '
        'selecionada', (tester) async {
      await _pumpRouter(tester);

      final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
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
      final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
      expect(bar.selectedIndex, 2);
      expect(_location(router), AppRoutes.cart);
    });

    testWidgets('/ vai para /home', (tester) async {
      final router = await _pumpRouter(tester, initialLocation: '/');

      expect(_location(router), AppRoutes.home);
      expect(find.byType(HomePage), findsOneWidget);
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
