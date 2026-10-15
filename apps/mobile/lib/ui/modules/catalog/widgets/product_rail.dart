import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/skeleton_box.dart';
import 'product_summary_card.dart';

/// Trilho horizontal de cards das seções de produtos da Início. Trilho, e não
/// a grade do web, porque 20 cards em duas colunas empurrariam as categorias
/// para fora da tela; não é preguiçoso (no máximo 12 itens). Os cards têm a
/// altura do mais alto da linha.
class ProductRail extends StatelessWidget {
  const ProductRail({
    super.key,
    required this.products,
    required this.onOpenProduct,
    this.cardWidth = featuredCardWidth,
  });

  /// Larguras dos cards: os `minCardWidth` de "Em destaque" e de "Ofertas da
  /// semana" no web.
  static const double featuredCardWidth = 180;
  static const double offersCardWidth = 220;

  /// Altura de um card com nome em duas linhas: `ProductGridSkeleton` do web
  /// (padding 12, imagem 120, nome 16, unidade 12, preço 20, espaços e
  /// borda).
  static const double skeletonHeight = 228;

  static const double _gap = AppSpacing.s14;

  final List<ProductSummary> products;

  /// Toque num card, com o slug do produto.
  final ValueChanged<String> onOpenProduct;
  final double cardWidth;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (index, product) in products.indexed) ...[
              if (index > 0) const SizedBox(width: _gap),
              SizedBox(
                width: cardWidth,
                child: ProductSummaryCard(
                  product: product,
                  onOpenProduct: onOpenProduct,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Blocos estáticos no lugar do trilho enquanto a seção carrega
/// ([count] cards da largura do card).
class ProductRailSkeleton extends StatelessWidget {
  const ProductRailSkeleton({
    super.key,
    required this.count,
    this.cardWidth = ProductRail.featuredCardWidth,
  });

  final int count;
  final double cardWidth;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        child: Row(
          children: [
            for (var index = 0; index < count; index++) ...[
              if (index > 0) const SizedBox(width: ProductRail._gap),
              SkeletonBox(
                width: cardWidth,
                height: ProductRail.skeletonHeight,
                radius: AppRadius.xl2,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
