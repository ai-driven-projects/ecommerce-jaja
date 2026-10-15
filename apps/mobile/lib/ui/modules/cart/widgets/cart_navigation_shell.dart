import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../shared/widgets/app_navigation_shell.dart';
import '../view_models/cart_view_model.dart';

/// O shell das abas com o badge do Carrinho: observa o carrinho e passa a
/// soma das quantidades ao [AppNavigationShell], que segue sem domínio.
class CartNavigationShell extends WatchingStatefulWidget {
  const CartNavigationShell({
    super.key,
    required this.navigationShell,
    required this.cartViewModelFactory,
  });

  final StatefulNavigationShell navigationShell;

  /// Cria o ViewModel do carrinho; a rota passa o `registerFactory` da DI.
  final CartViewModel Function() cartViewModelFactory;

  @override
  State<CartNavigationShell> createState() => _CartNavigationShellState();
}

class _CartNavigationShellState extends State<CartNavigationShell> {
  late final CartViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.cartViewModelFactory();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = watchPropertyValue(
      (CartViewModel vm) => vm.state.count,
      target: _viewModel,
    );

    return AppNavigationShell(
      navigationShell: widget.navigationShell,
      cartCount: count,
    );
  }
}
