import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_query.dart';
import '../../../shared/widgets/placeholder_body.dart';

/// Página provisória da aba Buscar. Já recebe o filtro decodificado da rota
/// ([initialQuery]); a etapa da busca a substitui.
class SearchPage extends StatelessWidget {
  const SearchPage({super.key, this.initialQuery = const ProductQuery()});

  final ProductQuery initialQuery;

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(child: PlaceholderBody(title: 'Buscar')),
    );
  }
}
