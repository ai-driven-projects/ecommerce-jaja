import 'package:flutter/material.dart';

import '../../../shared/widgets/placeholder_body.dart';

/// Página provisória do produto, aberta sobre a Início pelo [slug]; a etapa
/// do detalhe a substitui. Recebe a volta por callback, como as outras
/// páginas.
class ProductPage extends StatelessWidget {
  const ProductPage({super.key, required this.slug, required this.onBack});

  static const String title = 'Produto';

  final String slug;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: onBack)),
      body: const SafeArea(child: PlaceholderBody(title: title)),
    );
  }
}
