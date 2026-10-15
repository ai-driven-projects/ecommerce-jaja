import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/app_chip.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../view_models/category_art.dart';

/// Linha rolável de chips da Início, de `storefront-category-nav.component.tsx`:
/// "Tudo" e as categorias raiz, na ordem da API, cada uma com o emoji da raiz.
/// Nenhum chip fica ativo (a Início não filtra): o toque devolve a consulta
/// que abre a Buscar. A rolagem encosta nas bordas da tela, com o respiro de
/// 16 dentro dela, como o `-mx-4 px-4` do web.
class CategoryChipsRow extends StatelessWidget {
  const CategoryChipsRow({
    super.key,
    required this.roots,
    required this.onSelect,
    this.loading = false,
  });

  static const String allLabel = 'Tudo';

  /// Blocos do skeleton (`CategoryChipsSkeleton` do web).
  static const int skeletonCount = 9;

  static const double _skeletonWidth = 132;
  static const double _skeletonHeight = 37;

  final List<Category> roots;

  /// Consulta vazia em "Tudo"; filtrada pela categoria numa raiz.
  final ValueChanged<ProductQuery> onSelect;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Semantics(
        container: true,
        label: 'Carregando',
        excludeSemantics: true,
        child: _scrollable(
          physics: const NeverScrollableScrollPhysics(),
          children: List.filled(
            skeletonCount,
            const SkeletonBox(
              width: _skeletonWidth,
              height: _skeletonHeight,
              radius: AppRadius.pill,
            ),
          ),
        ),
      );
    }

    return _scrollable(
      children: [
        AppChip(
          label: allLabel,
          emoji: defaultCategoryArt.emoji,
          selected: false,
          onSelected: () => onSelect(const ProductQuery()),
        ),
        for (final root in roots)
          AppChip(
            label: root.name,
            emoji: categoryArtOf(root.slug).emoji,
            selected: false,
            onSelected: () => onSelect(ProductQuery(categorySlug: root.slug)),
          ),
      ],
    );
  }

  Widget _scrollable({required List<Widget> children, ScrollPhysics? physics}) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: physics,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      child: Row(
        children: [
          for (final (index, child) in children.indexed) ...[
            if (index > 0) const SizedBox(width: AppSpacing.s8),
            child,
          ],
        ],
      ),
    );
  }
}
