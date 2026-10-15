import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart' show WatchingWidget, watchPropertyValue;

import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/category_tree.dart';
import '../../../../modules/catalog/model/product_listing.dart';
import '../../../../modules/catalog/model/product_page_entity.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/formatters/product_count_formatter.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../../shared/view_models/block_state.dart';
import '../view_models/catalog_texts.dart';
import '../view_models/price_input.dart';
import '../view_models/search_view_model.dart';
import 'choice_row.dart';

/// Abre o painel "Filtros" sobre a Buscar. Cada mudança vale na hora, no
/// mesmo [viewModel] da página, e a listagem recarrega por trás do painel.
Future<void> showFiltersSheet(BuildContext context, SearchViewModel viewModel) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    constraints: BoxConstraints(
      maxHeight:
          MediaQuery.sizeOf(context).height * FiltersSheet.maxHeightFactor,
    ),
    builder: (_) => FiltersSheet(viewModel: viewModel),
  );
}

/// Conteúdo do painel: cabeçalho com fechar, os grupos Categoria, Marca,
/// Preço e Ofertas e destaques numa rolagem, e o rodapé fixo com "Limpar
/// filtros" e "Ver N produtos" (que só fecha). Controles de
/// `storefront-filters.component.tsx`, mais a categoria.
class FiltersSheet extends WatchingWidget {
  const FiltersSheet({super.key, required this.viewModel});

  static const double maxHeightFactor = 0.9;

  static const String title = 'Filtros';
  static const String closeTooltip = 'Fechar';
  static const String categoryTitle = 'Categoria';
  static const String brandTitle = 'Marca';
  static const String priceTitle = 'Preço';
  static const String flagsTitle = 'Ofertas e destaques';
  static const String allCategories = 'Todas as categorias';
  static const String categoriesErrorTitle = CatalogTexts.categoriesError;
  static const String noBrands = 'Nenhuma marca neste resultado.';
  static const String onSaleLabel = 'Só ofertas';
  static const String featuredLabel = CatalogTexts.featuredOnly;
  static const String clearLabel = CatalogTexts.clearFilters;
  static const String loadingResultsLabel = CatalogTexts.seeProducts;

  final SearchViewModel viewModel;

  /// Rótulo da ação principal: "Ver 12 produtos", "Ver produtos" enquanto a
  /// listagem carrega ou com falha.
  static String resultsLabel(
    BlockState<List<ProductSummary>> results,
    int total,
  ) => switch (results) {
    BlockLoaded() => 'Ver ${formatProductCount(total)}',
    BlockLoading() || BlockFailed() => loadingResultsLabel,
  };

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final query = watchPropertyValue(
      (SearchViewModel vm) => vm.query,
      target: viewModel,
    );
    final categories = watchPropertyValue(
      (SearchViewModel vm) => vm.categories,
      target: viewModel,
    );
    final results = watchPropertyValue(
      (SearchViewModel vm) => vm.results,
      target: viewModel,
    );
    final total = watchPropertyValue(
      (SearchViewModel vm) => vm.total,
      target: viewModel,
    );
    final brandFacets = watchPropertyValue(
      (SearchViewModel vm) => vm.brandFacets,
      target: viewModel,
    );

    return Padding(
      // O teclado dos campos de preço sobe o painel.
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.s16,
              AppSpacing.s4,
              AppSpacing.s4,
              AppSpacing.s4,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: textTheme.titleMedium!.copyWith(color: tokens.ink),
                  ),
                ),
                IconButton(
                  tooltip: closeTooltip,
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close, color: tokens.ink),
                ),
              ],
            ),
          ),
          Divider(height: 1, color: tokens.line),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _FilterGroup(
                    title: categoryTitle,
                    child: _categoryGroup(categories, query),
                  ),
                  _FilterGroup(
                    title: brandTitle,
                    child: switch (results) {
                      // As facetas são do resultado: somem a cada recarga.
                      BlockLoading() => const _GroupSkeleton(lines: 3),
                      BlockLoaded() || BlockFailed() => _BrandGroup(
                        selected: query.brandSlugs,
                        facets: brandFacets,
                        onToggle: viewModel.toggleBrand,
                      ),
                    },
                  ),
                  _FilterGroup(
                    title: priceTitle,
                    child: _PriceGroup(
                      // Remonta quando o filtro muda (pílula removida, rota),
                      // para os campos refletirem o preço em vigor.
                      key: ValueKey(
                        '${query.minPriceCents}-${query.maxPriceCents}',
                      ),
                      minCents: query.minPriceCents,
                      maxCents: query.maxPriceCents,
                      onApply: viewModel.setPriceRange,
                    ),
                  ),
                  _FilterGroup(
                    title: flagsTitle,
                    last: true,
                    child: Column(
                      children: [
                        _CheckRow(
                          label: onSaleLabel,
                          checked: query.onSale,
                          onChanged: viewModel.setOnSale,
                        ),
                        _CheckRow(
                          label: featuredLabel,
                          checked: query.featured,
                          onChanged: viewModel.setFeatured,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Divider(height: 1, color: tokens.line),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.s16),
              child: Row(
                children: [
                  if (hasCatalogFilters(query)) ...[
                    AppButton(
                      label: clearLabel,
                      onPressed: viewModel.clearFilters,
                      variant: AppButtonVariant.ghost,
                    ),
                    const SizedBox(width: AppSpacing.s8),
                  ],
                  Expanded(
                    child: AppButton(
                      label: resultsLabel(results, total),
                      onPressed: () => Navigator.of(context).pop(),
                      expand: true,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _categoryGroup(
    BlockState<List<Category>> categories,
    ProductQuery query,
  ) => switch (categories) {
    BlockLoading() => const _GroupSkeleton(lines: 4),
    BlockFailed(:final failure) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      child: StateErrorBanner(
        title: categoriesErrorTitle,
        failure: failure,
        onRetry: viewModel.loadCategories.execute,
      ),
    ),
    BlockLoaded(:final value) => Column(
      children: [
        ChoiceRow(
          label: allCategories,
          selected: query.categorySlug == null,
          onTap: () => viewModel.setCategory(null),
        ),
        for (final category in flattenCategoryTree(value))
          ChoiceRow(
            label: category.name,
            caption: formatProductCount(category.productCount),
            indent: AppSpacing.s16 * (category.level - 1),
            selected: category.slug == query.categorySlug,
            onTap: () => viewModel.setCategory(category.slug),
          ),
      ],
    ),
  };
}

/// Grupo com título pequeno e a linha divisória do web
/// (`FilterGroup`), menos no último.
class _FilterGroup extends StatelessWidget {
  const _FilterGroup({
    required this.title,
    required this.child,
    this.last = false,
  });

  final String title;
  final Widget child;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.s16,
            AppSpacing.s12,
            AppSpacing.s16,
            AppSpacing.s4,
          ),
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: textTheme.labelSmall!.copyWith(color: tokens.mutedInk),
            ),
          ),
        ),
        child,
        const SizedBox(height: AppSpacing.s12),
        if (!last) Divider(height: 1, color: tokens.line),
      ],
    );
  }
}

/// Linhas de carregamento no lugar do conteúdo de um grupo.
class _GroupSkeleton extends StatelessWidget {
  const _GroupSkeleton({required this.lines});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
        child: Column(
          children: [
            for (var index = 0; index < lines; index++) ...[
              if (index > 0) const SizedBox(height: AppSpacing.s8),
              const SkeletonBox(height: 32),
            ],
          ],
        ),
      ),
    );
  }
}

/// Opção de marcar e desmarcar (`CheckOption` do web), com a contagem à
/// direita quando houver.
class _CheckRow extends StatelessWidget {
  const _CheckRow({
    required this.label,
    required this.checked,
    required this.onChanged,
    this.count,
  });

  final String label;
  final bool checked;
  final ValueChanged<bool> onChanged;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final count = this.count;

    return CheckboxListTile(
      value: checked,
      onChanged: (value) => onChanged(value ?? false),
      dense: true,
      controlAffinity: ListTileControlAffinity.leading,
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
      title: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: textTheme.labelLarge!.copyWith(color: tokens.ink),
      ),
      secondary: count == null
          ? null
          : Text(
              '$count',
              style: textTheme.countCaption.copyWith(color: tokens.mutedInk),
            ),
    );
  }
}

/// Marcas do resultado com a contagem, oito visíveis e "Ver todas (N)" /
/// "Ver menos" (`BrandFilter` do web). Marca escolhida fora das facetas
/// continua marcada no topo, pelo slug.
class _BrandGroup extends StatefulWidget {
  const _BrandGroup({
    required this.selected,
    required this.facets,
    required this.onToggle,
  });

  /// Marcas visíveis antes de "Ver todas" (`VISIBLE_BRANDS` do web).
  static const int visibleBrands = 8;

  final List<String> selected;
  final List<BrandFacet> facets;
  final void Function(String slug, bool selected) onToggle;

  @override
  State<_BrandGroup> createState() => _BrandGroupState();
}

class _BrandGroupState extends State<_BrandGroup> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final facets = widget.facets;
    final missing = [
      for (final slug in widget.selected)
        if (!facets.any((facet) => facet.slug == slug))
          (slug: slug, name: slug, count: null),
    ];
    final options = [
      ...missing,
      for (final facet in facets)
        (slug: facet.slug, name: facet.name, count: facet.count),
    ];

    if (options.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
        child: Text(
          FiltersSheet.noBrands,
          style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
        ),
      );
    }

    final visible = _expanded
        ? options
        : options.take(_BrandGroup.visibleBrands).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final option in visible)
          _CheckRow(
            label: option.name,
            count: option.count,
            checked: widget.selected.contains(option.slug),
            onChanged: (checked) => widget.onToggle(option.slug, checked),
          ),
        if (options.length > _BrandGroup.visibleBrands)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
            child: AppButton(
              label: _expanded ? 'Ver menos' : 'Ver todas (${options.length})',
              onPressed: () => setState(() => _expanded = !_expanded),
              variant: AppButtonVariant.ghost,
              size: AppButtonSize.sm,
            ),
          ),
      ],
    );
  }
}

/// Faixa de preço em reais, aplicada por "Aplicar" (`PriceFilter` do web).
/// Valor que não é reais válido mostra o aviso e não aplica nada.
class _PriceGroup extends StatefulWidget {
  const _PriceGroup({
    super.key,
    required this.minCents,
    required this.maxCents,
    required this.onApply,
  });

  static const String minLabel = 'Mínimo (R\$)';
  static const String maxLabel = 'Máximo (R\$)';
  static const String invalidMessage = 'Use valores em reais, como 12,90.';
  static const String applyLabel = 'Aplicar';

  final int? minCents;
  final int? maxCents;
  final void Function(int? minCents, int? maxCents) onApply;

  @override
  State<_PriceGroup> createState() => _PriceGroupState();
}

class _PriceGroupState extends State<_PriceGroup> {
  late final TextEditingController _min = TextEditingController(
    text: _text(widget.minCents),
  );
  late final TextEditingController _max = TextEditingController(
    text: _text(widget.maxCents),
  );
  bool _invalid = false;

  static String _text(int? cents) =>
      cents == null ? '' : formatCentsAsReais(cents);

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  void _apply() {
    final minCents = parseReaisToCents(_min.text);
    final maxCents = parseReaisToCents(_max.text);
    final invalid =
        (_min.text.trim().isNotEmpty && minCents == null) ||
        (_max.text.trim().isNotEmpty && maxCents == null);
    setState(() => _invalid = invalid);
    if (!invalid) widget.onApply(minCents, maxCents);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    const keyboard = TextInputType.numberWithOptions(decimal: true);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AppTextField(
                  label: _PriceGroup.minLabel,
                  controller: _min,
                  hintText: '0,00',
                  keyboardType: keyboard,
                  textInputAction: TextInputAction.next,
                ),
              ),
              const SizedBox(width: AppSpacing.s8),
              Expanded(
                child: AppTextField(
                  label: _PriceGroup.maxLabel,
                  controller: _max,
                  hintText: '300',
                  keyboardType: keyboard,
                  textInputAction: TextInputAction.done,
                ),
              ),
            ],
          ),
          if (_invalid) ...[
            const SizedBox(height: AppSpacing.s8),
            Semantics(
              liveRegion: true,
              child: Text(
                _PriceGroup.invalidMessage,
                style: textTheme.bodySmall!.copyWith(color: tokens.danger),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.s10),
          AppButton(
            label: _PriceGroup.applyLabel,
            onPressed: _apply,
            variant: AppButtonVariant.secondary,
            size: AppButtonSize.sm,
          ),
        ],
      ),
    );
  }
}
