import 'package:flutter/material.dart';

import '../theme/brand_tokens.dart';

/// Variantes do selo usadas no card e na página do produto.
enum ProductBadgeVariant {
  /// Texto na cor da marca sobre branco, com sombra ("Destaque").
  brand,

  /// Fundo da marca com texto claro (`−N%`).
  solid,
}

/// Selo em pílula de `badge.tsx` (`px-2.5 py-[3px] text-[11.5px]`).
class ProductBadge extends StatelessWidget {
  const ProductBadge({
    super.key,
    required this.label,
    this.variant = ProductBadgeVariant.brand,
  });

  final String label;
  final ProductBadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final (background, foreground, shadows) = switch (variant) {
      ProductBadgeVariant.brand => (
        tokens.card,
        tokens.brand,
        tokens.shadowBadge,
      ),
      ProductBadgeVariant.solid => (tokens.brand, tokens.onBrand, null),
    };

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: background,
        shape: const StadiumBorder(),
        shadows: shadows,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        child: Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelSmall!.copyWith(color: foreground),
        ),
      ),
    );
  }
}
