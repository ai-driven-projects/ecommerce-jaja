import 'package:flutter/material.dart';

import '../../../../core/result.dart';
import '../../../../core/value_objects/money.dart';
import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/product_page_entity.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_chip.dart';
import '../view_models/catalog_texts.dart';

/// Uma pílula por filtro ativo, nesta ordem: a categoria, cada marca, o preço,
/// "Só ofertas" e "Só destaques" (`activeFilters` de
/// `storefront-listing.component.tsx`, mais a categoria, que no app mora no
/// painel). Tocar numa pílula remove só aquele filtro; "Limpar filtros" tira
/// todos. Sem filtro ativo não mostra nada.
class ActiveFilterPills extends StatelessWidget {
  const ActiveFilterPills({
    super.key,
    required this.query,
    required this.category,
    required this.brandFacets,
    required this.onRemoveCategory,
    required this.onRemoveBrand,
    required this.onClearPrice,
    required this.onRemoveOnSale,
    required this.onRemoveFeatured,
    required this.onClearFilters,
  });

  static const String onSaleLabel = 'Só ofertas';
  static const String featuredLabel = CatalogTexts.featuredOnly;
  static const String clearLabel = CatalogTexts.clearFilters;

  /// Quantidade de pílulas de [query]: o n de "Filtros (n)".
  static int countOf(ProductQuery query) =>
      (query.categorySlug != null ? 1 : 0) +
      query.brandSlugs.length +
      (query.minPriceCents != null || query.maxPriceCents != null ? 1 : 0) +
      (query.onSale ? 1 : 0) +
      (query.featured ? 1 : 0);

  /// Rótulo da pílula de preço: "R$ 12,90 a R$ 300,00", "a partir de
  /// R$ 12,90" ou "até R$ 300,00" (`priceLabel` do web).
  static String priceLabel(int? minCents, int? maxCents) {
    if (minCents != null && maxCents != null) {
      return '${_reais(minCents)} a ${_reais(maxCents)}';
    }
    if (minCents != null) return 'a partir de ${_reais(minCents)}';
    return 'até ${_reais(maxCents ?? 0)}';
  }

  final ProductQuery query;

  /// A categoria do filtro resolvida na árvore; sem ela (árvore carregando,
  /// com falha ou slug desconhecido) a pílula mostra o slug.
  final Category? category;

  /// Marcas do resultado; marca sem faceta aparece pelo slug.
  final List<BrandFacet> brandFacets;

  final VoidCallback onRemoveCategory;
  final ValueChanged<String> onRemoveBrand;
  final VoidCallback onClearPrice;
  final VoidCallback onRemoveOnSale;
  final VoidCallback onRemoveFeatured;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    final categorySlug = query.categorySlug;
    final minCents = query.minPriceCents;
    final maxCents = query.maxPriceCents;

    final pills = [
      if (categorySlug != null)
        _pill(category?.name ?? categorySlug, onRemoveCategory),
      for (final slug in query.brandSlugs)
        _pill(_brandName(slug), () => onRemoveBrand(slug)),
      if (minCents != null || maxCents != null)
        _pill(priceLabel(minCents, maxCents), onClearPrice),
      if (query.onSale) _pill(onSaleLabel, onRemoveOnSale),
      if (query.featured) _pill(featuredLabel, onRemoveFeatured),
    ];
    if (pills.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: AppSpacing.s8,
      runSpacing: AppSpacing.s8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ...pills,
        AppButton(
          label: clearLabel,
          onPressed: onClearFilters,
          variant: AppButtonVariant.ghost,
          size: AppButtonSize.sm,
        ),
      ],
    );
  }

  String _brandName(String slug) {
    for (final facet in brandFacets) {
      if (facet.slug == slug) return facet.name;
    }
    return slug;
  }

  Widget _pill(String label, VoidCallback onRemove) => AppChip(
    label: label,
    selected: true,
    onSelected: onRemove,
    size: AppChipSize.sm,
    trailingIcon: Icons.close,
  );

  static String _reais(int cents) => switch (Money.fromCents(cents)) {
    Ok(:final value) => formatMoney(value),
    Failure() => formatMoney(Money.zero),
  };
}
