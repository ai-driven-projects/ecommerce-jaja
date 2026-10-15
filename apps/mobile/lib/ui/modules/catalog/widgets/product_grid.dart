import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/skeleton_box.dart';
import 'product_rail.dart';
import 'product_summary_card.dart';

const double _gap = AppSpacing.s14;

/// Grade de duas colunas da Buscar, como sliver preguiçoso de linhas: cada
/// linha tem a altura do card mais alto dela (nome em duas linhas e escala de
/// texto estourariam uma altura fixa). Linha ímpar deixa o último card à
/// esquerda, na largura de uma coluna.
class ProductGrid extends StatelessWidget {
  const ProductGrid({
    super.key,
    required this.products,
    required this.onOpenProduct,
  });

  final List<ProductSummary> products;

  /// Toque num card, com o slug do produto.
  final ValueChanged<String> onOpenProduct;

  @override
  Widget build(BuildContext context) {
    final rows = (products.length + 1) ~/ 2;

    return SliverList.separated(
      itemCount: rows,
      separatorBuilder: (_, _) => const SizedBox(height: _gap),
      itemBuilder: (context, row) {
        final first = row * 2;
        final second = first + 1;
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _card(products[first])),
              const SizedBox(width: _gap),
              Expanded(
                child: second < products.length
                    ? _card(products[second])
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _card(ProductSummary product) =>
      ProductSummaryCard(product: product, onOpenProduct: onOpenProduct);
}

/// Blocos estáticos no lugar da grade: [count] cards em linhas de dois, da
/// altura do card do trilho.
class ProductGridSkeleton extends StatelessWidget {
  const ProductGridSkeleton({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final rows = (count + 1) ~/ 2;

    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: Column(
        children: [
          for (var row = 0; row < rows; row++) ...[
            if (row > 0) const SizedBox(height: _gap),
            Row(
              children: [
                Expanded(child: _block()),
                const SizedBox(width: _gap),
                Expanded(
                  child: row * 2 + 1 < count
                      ? _block()
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _block() => const SkeletonBox(
    height: ProductRail.skeletonHeight,
    radius: AppRadius.xl2,
  );
}
