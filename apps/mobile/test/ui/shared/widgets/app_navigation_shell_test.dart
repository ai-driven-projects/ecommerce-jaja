import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_navigation_shell.dart';

/// Monta o shell num router mínimo de quatro abas, como o do app.
Future<void> _pumpShell(WidgetTester tester, {int cartCount = 0}) async {
  StatefulShellBranch branch(String path) => StatefulShellBranch(
    routes: [GoRoute(path: path, builder: (_, _) => Text(path))],
  );
  final router = GoRouter(
    initialLocation: '/home',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppNavigationShell(
          navigationShell: navigationShell,
          cartCount: cartCount,
        ),
        branches: [
          branch('/home'),
          branch('/search'),
          branch('/cart'),
          branch('/account'),
        ],
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    MaterialApp.router(routerConfig: router, theme: AppTheme.light()),
  );
  await tester.pumpAndSettle();
}

Badge get _badge => find
    .descendant(of: find.byType(NavigationBar), matching: find.byType(Badge))
    .evaluate()
    .map((element) => element.widget as Badge)
    .single;

void main() {
  testWidgets('sem itens, o badge do Carrinho não aparece', (tester) async {
    await _pumpShell(tester);

    expect(_badge.isLabelVisible, isFalse);
    expect(find.text('0'), findsNothing);
  });

  testWidgets('com 3 itens, o badge mostra "3"', (tester) async {
    await _pumpShell(tester, cartCount: 3);

    expect(_badge.isLabelVisible, isTrue);
    expect(
      find.descendant(of: find.byType(Badge), matching: find.text('3')),
      findsOneWidget,
    );
  });

  testWidgets('acima de 99, o badge mostra "99+"', (tester) async {
    await _pumpShell(tester, cartCount: 120);

    expect(
      find.descendant(of: find.byType(Badge), matching: find.text('99+')),
      findsOneWidget,
    );
    expect(find.text('120'), findsNothing);
  });

  test('cartBadgeLabel limita a 99+', () {
    expect(AppNavigationShell.cartBadgeLabel(1), '1');
    expect(AppNavigationShell.cartBadgeLabel(99), '99');
    expect(AppNavigationShell.cartBadgeLabel(100), '99+');
  });
}
