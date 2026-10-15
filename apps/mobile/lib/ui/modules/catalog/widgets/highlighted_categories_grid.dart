import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/home_catalog.dart';
import '../../../shared/formatters/product_count_formatter.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/product_art.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../view_models/category_art.dart';

/// "Categorias em destaque" da Início (`HighlightedCategories` do web): duas
/// colunas de cartões com o emoji sobre o tom da raiz, o nome e "N produtos".
/// Não rola: a página é quem rola. As linhas são `Row`s de altura intrínseca,
/// e não uma grade de extensão fixa, porque o cartão cresce com o nome em duas
/// linhas e com a escala de texto; [tileHeight] é o mínimo.
class HighlightedCategoriesGrid extends StatelessWidget {
  const HighlightedCategoriesGrid({
    super.key,
    required this.categories,
    required this.onOpenCategory,
  });

  /// Altura mínima do cartão: o quadrado do emoji com o padding e a borda
  /// (`h-[74px]` do skeleton do web).
  static const double tileHeight = 74;

  static const double _artSize = 48;

  final List<HighlightedCategory> categories;

  /// Toque num cartão, com o slug da categoria.
  final ValueChanged<String> onOpenCategory;

  @override
  Widget build(BuildContext context) {
    return _TwoColumns(
      tiles: [
        for (final (:category, :rootSlug) in categories)
          _Tile(
            name: category.name,
            productCount: category.productCount,
            art: categoryArtOf(rootSlug),
            onTap: () => onOpenCategory(category.slug),
          ),
      ],
    );
  }
}

/// Seis cartões estáticos no lugar da grade enquanto as categorias carregam.
class HighlightedCategoriesGridSkeleton extends StatelessWidget {
  const HighlightedCategoriesGridSkeleton({super.key});

  static const int count = 6;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: _TwoColumns(
        tiles: List.filled(
          count,
          const SkeletonBox(
            height: HighlightedCategoriesGrid.tileHeight,
            radius: AppRadius.xl2,
          ),
        ),
      ),
    );
  }
}

/// Duas colunas com espaçamento 14 (`grid-cols-2 gap-3.5`); a última linha
/// de uma lista ímpar fica com o cartão só na esquerda.
class _TwoColumns extends StatelessWidget {
  const _TwoColumns({required this.tiles});

  static const double _gap = AppSpacing.s14;

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var index = 0; index < tiles.length; index += 2) ...[
          if (index > 0) const SizedBox(height: _gap),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: tiles[index]),
                const SizedBox(width: _gap),
                Expanded(
                  child: index + 1 < tiles.length
                      ? tiles[index + 1]
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.name,
    required this.productCount,
    required this.art,
    required this.onTap,
  });

  final String name;
  final int productCount;
  final CategoryArt art;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final count = formatProductCount(productCount);

    return Semantics(
      container: true,
      button: true,
      excludeSemantics: true,
      label: '$name, $count',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: tokens.card,
            border: Border.all(color: tokens.line),
            borderRadius: BorderRadius.circular(AppRadius.xl2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s12),
            child: Row(
              children: [
                SizedBox.square(
                  dimension: HighlightedCategoriesGrid._artSize,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: art.tint.colorIn(tokens),
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                    ),
                    child: Center(
                      child: Text(art.emoji, style: textTheme.tileEmoji),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.titleSmall!.copyWith(
                          color: tokens.ink,
                        ),
                      ),
                      Text(
                        count,
                        style: textTheme.countCaption.copyWith(
                          color: tokens.mutedInk,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
