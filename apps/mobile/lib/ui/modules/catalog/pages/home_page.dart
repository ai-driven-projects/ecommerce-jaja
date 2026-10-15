import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/home_catalog.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../store/view_models/store_selector_view_model.dart';
import '../../store/widgets/store_picker_sheet.dart';
import '../../store/widgets/store_selector.dart';
import '../../../shared/view_models/block_state.dart';
import '../view_models/catalog_texts.dart';
import '../view_models/home_view_model.dart';
import '../widgets/category_chips_row.dart';
import '../widgets/highlighted_categories_grid.dart';
import '../widgets/home_hero.dart';
import '../widgets/home_section.dart';
import '../widgets/product_rail.dart';

/// Aba Início: o seletor de loja no topo e, numa rolagem só, a linha de chips
/// das categorias, o hero da marca, "Em destaque", "Ofertas da semana" e
/// "Categorias em destaque". Cada bloco remoto segue o padrão de tela remota
/// por conta própria; puxar a tela refaz tudo, inclusive as lojas. A
/// navegação sai por callback: a rota decide para onde cada toque leva.
class HomePage extends WatchingStatefulWidget {
  const HomePage({
    super.key,
    required this.storeSelectorViewModelFactory,
    required this.homeViewModelFactory,
    required this.onOpenSearch,
    required this.onOpenProduct,
  });

  static const String featuredTitle = 'Em destaque';
  static const String offersTitle = 'Ofertas da semana';
  static const String highlightedTitle = 'Categorias em destaque';
  static const String categoriesErrorTitle = CatalogTexts.categoriesError;
  static const String featuredErrorTitle =
      'Não foi possível carregar os destaques.';
  static const String offersErrorTitle =
      'Não foi possível carregar as ofertas.';
  static const String emptyTitle = CatalogTexts.emptyTitle;
  static const String emptyMessage = 'O catálogo está vazio no momento.';
  static const String emptyAction = 'Ver catálogo';

  /// `skeletonCount` das seções de produtos no web.
  static const int featuredSkeletonCount = 6;
  static const int offersSkeletonCount = 4;

  /// Cria o ViewModel do seletor; a rota passa o `registerFactory` da DI.
  final StoreSelectorViewModel Function() storeSelectorViewModelFactory;

  /// Cria o ViewModel dos blocos do catálogo; idem.
  final HomeViewModel Function() homeViewModelFactory;

  /// Abre a aba Buscar com a consulta (vazia em "Tudo" e em "Ver catálogo").
  final ValueChanged<ProductQuery> onOpenSearch;

  /// Abre o produto pelo slug, sobre a Início.
  final ValueChanged<String> onOpenProduct;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final StoreSelectorViewModel _storeSelector;
  late final HomeViewModel _home;

  @override
  void initState() {
    super.initState();
    _storeSelector = widget.storeSelectorViewModelFactory();
    _home = widget.homeViewModelFactory();
    _storeSelector.load.execute();
    _home.loadAll();
  }

  @override
  void dispose() {
    _storeSelector.dispose();
    _home.dispose();
    super.dispose();
  }

  Future<void> _refresh() =>
      Future.wait([_storeSelector.reload.execute(), _home.refresh()]);

  Future<void> _changeStore() async {
    final stores = _storeSelector.stores;
    final current = _storeSelector.current;
    if (stores.length < 2 || current == null) return;

    final slug = await showStorePickerSheet(
      context,
      stores: stores,
      currentSlug: current.slug,
    );
    if (slug == null) return;
    await _storeSelector.select.execute(slug);
  }

  void _openCategory(String slug) =>
      widget.onOpenSearch(ProductQuery(categorySlug: slug));

  @override
  Widget build(BuildContext context) {
    final loading = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.loading,
      target: _storeSelector,
    );
    final failure = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.failure,
      target: _storeSelector,
    );
    final stores = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.stores,
      target: _storeSelector,
    );
    final current = watchPropertyValue(
      (StoreSelectorViewModel vm) => vm.current,
      target: _storeSelector,
    );
    final categories = watchPropertyValue(
      (HomeViewModel vm) => vm.categories,
      target: _home,
    );
    final featured = watchPropertyValue(
      (HomeViewModel vm) => vm.featured,
      target: _home,
    );
    final offers = watchPropertyValue(
      (HomeViewModel vm) => vm.offers,
      target: _home,
    );
    // Derivados dos três blocos observados acima: mudam só quando eles mudam.
    final isEverythingEmpty = _home.isEverythingEmpty;
    final highlighted = switch (categories) {
      BlockLoading() => const BlockLoading<List<HighlightedCategory>>(),
      // A falha das categorias já tem o banner na linha de chips: sem seção.
      BlockFailed() => null,
      BlockLoaded() => BlockLoaded(_home.highlighted),
    };

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.s16),
            children: [
              _padded(
                StoreSelector(
                  loading: loading,
                  failure: failure,
                  stores: stores,
                  current: current,
                  onReload: _storeSelector.reload.execute,
                  onChangeStore: _changeStore,
                ),
              ),
              if (isEverythingEmpty) ...[
                const SizedBox(height: AppSpacing.s16),
                _padded(HomeHero(storeName: current?.name)),
                const SizedBox(height: AppSpacing.s24),
                _padded(
                  EmptyState(
                    emoji: '🛒',
                    title: HomePage.emptyTitle,
                    message: HomePage.emptyMessage,
                    actionLabel: HomePage.emptyAction,
                    onAction: () => widget.onOpenSearch(const ProductQuery()),
                  ),
                ),
              ] else ...[
                const SizedBox(height: AppSpacing.s16),
                _categoryChips(categories),
                const SizedBox(height: AppSpacing.s16),
                _padded(HomeHero(storeName: current?.name)),
                const SizedBox(height: AppSpacing.s24),
                _padded(
                  HomeSection<ProductSummary>(
                    title: HomePage.featuredTitle,
                    state: featured,
                    errorTitle: HomePage.featuredErrorTitle,
                    onRetry: _home.loadFeatured.execute,
                    onSeeAll: () =>
                        widget.onOpenSearch(const ProductQuery(featured: true)),
                    skeleton: const ProductRailSkeleton(
                      count: HomePage.featuredSkeletonCount,
                      cardWidth: ProductRail.featuredCardWidth,
                    ),
                    builder: (items) => ProductRail(
                      products: items,
                      onOpenProduct: widget.onOpenProduct,
                      cardWidth: ProductRail.featuredCardWidth,
                    ),
                  ),
                ),
                _gapAfter(featured),
                _padded(
                  HomeSection<ProductSummary>(
                    title: HomePage.offersTitle,
                    state: offers,
                    errorTitle: HomePage.offersErrorTitle,
                    onRetry: _home.loadOffers.execute,
                    onSeeAll: () => widget.onOpenSearch(
                      const ProductQuery(
                        onSale: true,
                        sort: ProductSort.discount,
                      ),
                    ),
                    skeleton: const ProductRailSkeleton(
                      count: HomePage.offersSkeletonCount,
                      cardWidth: ProductRail.offersCardWidth,
                    ),
                    builder: (items) => ProductRail(
                      products: items,
                      onOpenProduct: widget.onOpenProduct,
                      cardWidth: ProductRail.offersCardWidth,
                    ),
                  ),
                ),
                _gapAfter(offers),
                if (highlighted != null)
                  _padded(
                    HomeSection<HighlightedCategory>(
                      title: HomePage.highlightedTitle,
                      state: highlighted,
                      errorTitle: HomePage.categoriesErrorTitle,
                      onRetry: _home.loadCategories.execute,
                      skeleton: const HighlightedCategoriesGridSkeleton(),
                      builder: (items) => HighlightedCategoriesGrid(
                        categories: items,
                        onOpenCategory: _openCategory,
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _categoryChips(BlockState<List<Category>> categories) {
    return switch (categories) {
      BlockLoading() => CategoryChipsRow(
        roots: const [],
        onSelect: widget.onOpenSearch,
        loading: true,
      ),
      BlockFailed(:final failure) => _padded(
        StateErrorBanner(
          title: HomePage.categoriesErrorTitle,
          failure: failure,
          onRetry: _home.loadCategories.execute,
        ),
      ),
      BlockLoaded(:final value) => CategoryChipsRow(
        roots: value,
        onSelect: widget.onOpenSearch,
      ),
    };
  }

  // Só a linha de chips vai de borda a borda; o resto fica no respiro de 16.
  Widget _padded(Widget child) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
    child: child,
  );

  // Uma seção carregada e vazia some inteira, inclusive o espaço depois dela.
  Widget _gapAfter(BlockState<List<Object>> state) => switch (state) {
    BlockLoaded(:final value) when value.isEmpty => const SizedBox.shrink(),
    _ => const SizedBox(height: AppSpacing.s24),
  };
}
