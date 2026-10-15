import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/brand_tokens.dart';

/// Shell das abas: o conteúdo da aba atual e a barra inferior com Início,
/// Buscar, Carrinho e Conta, nessa ordem (a mesma dos ramos do router). O
/// Carrinho leva um badge com [cartCount] quando há itens ("99+" acima de 99);
/// quem conhece o carrinho passa o número.
class AppNavigationShell extends StatelessWidget {
  const AppNavigationShell({
    super.key,
    required this.navigationShell,
    this.cartCount = 0,
  });

  /// Maior número exibido no badge; acima dele, "99+".
  static const int maxBadgeCount = 99;

  static String cartBadgeLabel(int count) =>
      count > maxBadgeCount ? '$maxBadgeCount+' : '$count';

  final StatefulNavigationShell navigationShell;
  final int cartCount;

  // Tocar na aba ativa volta à raiz dela; nas outras, reabre a pilha guardada.
  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    Widget cartIcon(IconData icon) => Badge(
      isLabelVisible: cartCount > 0,
      label: Text(cartBadgeLabel(cartCount)),
      backgroundColor: tokens.brand,
      textColor: tokens.onBrand,
      child: Icon(icon),
    );

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: DecoratedBox(
        position: DecorationPosition.foreground,
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: tokens.line)),
        ),
        child: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: _onDestinationSelected,
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Início',
            ),
            const NavigationDestination(
              icon: Icon(Icons.search_outlined),
              selectedIcon: Icon(Icons.search),
              label: 'Buscar',
            ),
            NavigationDestination(
              icon: cartIcon(Icons.shopping_bag_outlined),
              selectedIcon: cartIcon(Icons.shopping_bag),
              label: 'Carrinho',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Conta',
            ),
          ],
        ),
      ),
    );
  }
}
