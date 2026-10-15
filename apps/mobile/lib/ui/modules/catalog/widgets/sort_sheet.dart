import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_query.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import 'choice_row.dart';

/// Rótulos das ordens, os de `ORDER_OPTIONS` em
/// `storefront-listing.component.tsx`.
const Map<ProductSort, String> productSortLabels = {
  ProductSort.relevance: 'Mais relevantes',
  ProductSort.featured: 'Destaques',
  ProductSort.priceAsc: 'Menor preço',
  ProductSort.priceDesc: 'Maior preço',
  ProductSort.name: 'Nome (A–Z)',
  ProductSort.discount: 'Maior desconto',
};

/// Abre o painel "Ordenar por" com [options] e devolve a ordem tocada, ou
/// `null` se a pessoa fechou o painel sem escolher.
Future<ProductSort?> showSortSheet(
  BuildContext context, {
  required ProductSort current,
  required List<ProductSort> options,
}) {
  // Seis opções passam da altura padrão do painel (9/16 da tela).
  return showModalBottomSheet<ProductSort>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => SortSheet(current: current, options: options),
  );
}

/// Conteúdo do painel: o título e uma linha por ordem, com a atual marcada.
/// Tocar numa linha fecha o painel com a ordem dela.
class SortSheet extends StatelessWidget {
  const SortSheet({super.key, required this.current, required this.options});

  static const String title = 'Ordenar por';

  /// A ordem efetiva da listagem.
  final ProductSort current;
  final List<ProductSort> options;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.s16,
                AppSpacing.s4,
                AppSpacing.s16,
                AppSpacing.s8,
              ),
              child: Text(
                title,
                style: textTheme.titleMedium!.copyWith(color: tokens.ink),
              ),
            ),
            for (final sort in options)
              ChoiceRow(
                label: productSortLabels[sort]!,
                selected: sort == current,
                onTap: () => Navigator.of(context).pop(sort),
              ),
            const SizedBox(height: AppSpacing.s8),
          ],
        ),
      ),
    );
  }
}
