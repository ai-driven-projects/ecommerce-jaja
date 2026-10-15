import 'package:flutter/material.dart';

import '../../../shared/widgets/placeholder_body.dart';

/// Página provisória da aba Carrinho.
class CartPage extends StatelessWidget {
  const CartPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(child: PlaceholderBody(title: 'Carrinho')),
    );
  }
}
