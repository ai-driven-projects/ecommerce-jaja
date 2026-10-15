import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Ficha do produto, do `<dl>` de `product-detail.component.tsx`: "Marca",
/// "Categoria" (a trilha unida por " / "), "Código" e "Unidade", uma linha
/// por item, sem as linhas sem valor.
class ProductSpecs extends StatelessWidget {
  const ProductSpecs({super.key, required this.product});

  static const String brandLabel = 'Marca';
  static const String categoryLabel = 'Categoria';
  static const String skuLabel = 'Código';
  static const String unitLabel = 'Unidade';

  final ProductDetail product;

  /// Os pares (rótulo, valor) na ordem do web.
  static List<(String, String)> specsOf(ProductDetail product) {
    final brand = product.brand;
    final sku = product.sku;
    return [
      if (brand != null) (brandLabel, brand.name),
      if (product.categories.isNotEmpty)
        (
          categoryLabel,
          product.categories.map((category) => category.name).join(' / '),
        ),
      if (sku != null) (skuLabel, sku),
      (unitLabel, product.unit),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final specs = specsOf(product);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, (label, value)) in specs.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.s8),
          DecoratedBox(
            decoration: BoxDecoration(
              color: tokens.surface,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '$label · ',
                      style: textTheme.specsBody.copyWith(
                        color: tokens.mutedInk,
                      ),
                    ),
                    TextSpan(
                      text: value,
                      style: textTheme.specsValue.copyWith(color: tokens.ink),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
