import 'package:flutter/material.dart';

import '../../../shared/widgets/placeholder_body.dart';

/// Página provisória da aba Buscar.
class SearchPage extends StatelessWidget {
  const SearchPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(child: PlaceholderBody(title: 'Buscar')),
    );
  }
}
