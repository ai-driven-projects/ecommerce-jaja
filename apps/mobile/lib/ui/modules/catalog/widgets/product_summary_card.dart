import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/widgets/product_card.dart';
import '../view_models/category_art.dart';

/// [ProductCard] de um [ProductSummary], com a reserva da raiz da categoria
/// (`categoryArtOf`). Usado pelo trilho da Início e pela grade da Buscar.
class ProductSummaryCard extends StatelessWidget {
  const ProductSummaryCard({
    super.key,
    required this.product,
    required this.onOpenProduct,
  });

  final ProductSummary product;

  /// Toque no card, com o slug do produto.
  final ValueChanged<String> onOpenProduct;

  @override
  Widget build(BuildContext context) {
    final art = categoryArtOf(product.rootCategorySlug);

    return ProductCard(
      name: product.name,
      unit: product.unit,
      price: product.price,
      previousPrice: product.listPrice,
      discountPercent: product.discountPercent,
      featured: product.isFeatured,
      imageUrl: product.thumbUrl,
      emoji: art.emoji,
      tint: art.tint,
      onTap: () => onOpenProduct(product.slug),
    );
  }
}
