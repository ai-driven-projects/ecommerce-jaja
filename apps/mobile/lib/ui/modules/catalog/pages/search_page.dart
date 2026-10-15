import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../core/errors/app_failure.dart';
import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/product_listing.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/formatters/product_count_formatter.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../../shared/view_models/block_state.dart';
import '../view_models/search_view_model.dart';
import '../widgets/active_filter_pills.dart';
import '../widgets/filters_sheet.dart';
import '../widgets/product_grid.dart';
import '../widgets/search_field.dart';
import '../widgets/sort_sheet.dart';

/// Aba Buscar: o campo de busca fixo no topo e, numa rolagem com "puxar para
/// atualizar", os botões "Filtros (n)" e de ordem, o título com a contagem, as
/// pílulas dos filtros ativos e a grade com paginação infinita
/// (`storefront-listing.component.tsx`, com os painéis inferiores do app no
/// lugar da barra lateral e da paginação por botões). O filtro em vigor sai
/// por [onQueryChanged], para a rota espelhá-lo; o filtro da rota entra por
/// [initialQuery].
class SearchPage extends WatchingStatefulWidget {
  const SearchPage({
    super.key,
    required this.searchViewModelFactory,
    required this.onQueryChanged,
    required this.onOpenProduct,
    this.initialQuery = const ProductQuery(),
  });

  static const String defaultTitle = 'Produtos';
  static const String featuredTitle = 'Em destaque';
  static const String onSaleTitle = 'Ofertas';
  static const String pendingText = '…';
  static const String filtersLabel = 'Filtros';
  static const String errorTitle = 'Não deu para carregar os produtos.';
  static const String loadMoreErrorTitle =
      'Não foi possível carregar mais produtos.';
  static const String emptyTitle = 'Nada por aqui. Já já.';
  static const String emptyMessage =
      'Tente limpar os filtros ou buscar outro termo.';
  static const String clearFiltersAction = 'Limpar filtros';
  static const String clearSearchAction = 'Limpar busca';
  static const String refreshAction = 'Atualizar';

  /// Cartões de skeleton da primeira página e da página seguinte.
  static const int skeletonCount = 6;
  static const int footerSkeletonCount = 2;

  /// Distância do fim da rolagem que já pede a próxima página.
  static const double loadMoreThreshold = 600;

  /// Título da busca por texto.
  static String searchTitle(String term) => 'Resultados para “$term”';

  /// Rótulo do botão do painel: "Filtros (2)", ou só "Filtros" sem filtro.
  static String filtersButtonLabel(int count) =>
      count == 0 ? filtersLabel : '$filtersLabel ($count)';

  /// Cria o ViewModel da aba; a rota passa o `registerFactory` da DI.
  final SearchViewModel Function() searchViewModelFactory;

  /// Filtro decodificado da rota: o da primeira montagem e, quando a rota
  /// muda com a página montada, o que passa a valer.
  final ProductQuery initialQuery;

  /// O filtro em vigor mudou (normalizado, sem página).
  final ValueChanged<ProductQuery> onQueryChanged;

  /// Abre o produto pelo slug.
  final ValueChanged<String> onOpenProduct;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  late final SearchViewModel _search;
  final TextEditingController _searchField = TextEditingController();
  final ScrollController _scroll = ScrollController();
  late ProductQuery _lastQuery;
  bool _postFrameScheduled = false;
  bool _queryChanged = false;

  @override
  void initState() {
    super.initState();
    _search = widget.searchViewModelFactory();
    _search.start(widget.initialQuery);
    // O filtro inicial veio da rota: não volta para ela.
    _lastQuery = _search.query;
    _searchField.text = _search.searchText;
    _search.addListener(_onSearchChanged);
  }

  @override
  void didUpdateWidget(SearchPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialQuery != oldWidget.initialQuery) {
      _search.applyQuery(widget.initialQuery);
    }
  }

  @override
  void dispose() {
    _search.removeListener(_onSearchChanged);
    _search.dispose();
    _searchField.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// A cada mudança do ViewModel: iguala o campo ao texto em vigor (filtro
  /// vindo da rota, "Limpar busca") e, depois do quadro, avisa a rota do
  /// filtro novo, volta ao topo e confere se a lista ainda cabe na tela.
  void _onSearchChanged() {
    if (_searchField.text != _search.searchText) {
      _searchField.text = _search.searchText;
    }
    if (_search.query != _lastQuery) {
      _lastQuery = _search.query;
      _queryChanged = true;
    }
    if (_postFrameScheduled) return;
    _postFrameScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _afterFrame());
  }

  void _afterFrame() {
    _postFrameScheduled = false;
    if (!mounted) return;
    if (_queryChanged) {
      _queryChanged = false;
      if (_scroll.hasClients) _scroll.jumpTo(0);
      widget.onQueryChanged(_search.query);
    }
    // Lista curta não rola: sem esta checagem a próxima página nunca sairia.
    if (_scroll.hasClients &&
        _scroll.position.extentAfter < SearchPage.loadMoreThreshold) {
      _loadMore();
    }
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.depth == 0 &&
        notification.metrics.axis == Axis.vertical &&
        notification.metrics.extentAfter < SearchPage.loadMoreThreshold) {
      _loadMore();
    }
    return false;
  }

  void _loadMore() {
    if (!_search.hasMore ||
        _search.loadingMore ||
        _search.loadMoreFailure != null) {
      return;
    }
    _search.loadMore.execute();
  }

  Future<void> _clearSearch() async {
    await _search.clearSearch();
  }

  Future<void> _chooseSort() async {
    final query = _search.query;
    final current = effectiveSort(query);
    final picked = await showSortSheet(
      context,
      current: current,
      options: listingSorts(query),
    );
    // A ordem que já vale não recarrega a listagem.
    if (picked == null || picked == current) return;
    await _search.setSort(picked);
  }

  @override
  Widget build(BuildContext context) {
    final query = watchPropertyValue(
      (SearchViewModel vm) => vm.query,
      target: _search,
    );
    final results = watchPropertyValue(
      (SearchViewModel vm) => vm.results,
      target: _search,
    );
    final total = watchPropertyValue(
      (SearchViewModel vm) => vm.total,
      target: _search,
    );
    final brandFacets = watchPropertyValue(
      (SearchViewModel vm) => vm.brandFacets,
      target: _search,
    );
    final categories = watchPropertyValue(
      (SearchViewModel vm) => vm.categories,
      target: _search,
    );
    final filteredCategory = watchPropertyValue(
      (SearchViewModel vm) => vm.filteredCategory,
      target: _search,
    );
    final loadingMore = watchPropertyValue(
      (SearchViewModel vm) => vm.loadingMore,
      target: _search,
    );
    final loadMoreFailure = watchPropertyValue(
      (SearchViewModel vm) => vm.loadMoreFailure,
      target: _search,
    );

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.s16,
                AppSpacing.s16,
                AppSpacing.s16,
                AppSpacing.s8,
              ),
              child: SearchField(
                controller: _searchField,
                onChanged: _search.onSearchChanged,
                onSubmitted: _search.submitSearch,
                onClear: _clearSearch,
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _search.refresh,
                child: NotificationListener<ScrollNotification>(
                  onNotification: _onScroll,
                  child: CustomScrollView(
                    controller: _scroll,
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.s16,
                          AppSpacing.s8,
                          AppSpacing.s16,
                          0,
                        ),
                        sliver: SliverToBoxAdapter(
                          child: _header(
                            context,
                            query: query,
                            results: results,
                            total: total,
                            categories: categories,
                            filteredCategory: filteredCategory,
                          ),
                        ),
                      ),
                      if (ActiveFilterPills.countOf(query) > 0)
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.s16,
                            AppSpacing.s12,
                            AppSpacing.s16,
                            0,
                          ),
                          sliver: SliverToBoxAdapter(
                            child: ActiveFilterPills(
                              query: query,
                              category: filteredCategory,
                              brandFacets: brandFacets,
                              onRemoveCategory: () => _search.setCategory(null),
                              onRemoveBrand: _search.removeBrand,
                              onClearPrice: _search.clearPrice,
                              onRemoveOnSale: () => _search.setOnSale(false),
                              onRemoveFeatured: () =>
                                  _search.setFeatured(false),
                              onClearFilters: _search.clearFilters,
                            ),
                          ),
                        ),
                      SliverPadding(
                        padding: const EdgeInsets.all(AppSpacing.s16),
                        sliver: _body(
                          query: query,
                          results: results,
                          loadingMore: loadingMore,
                          loadMoreFailure: loadMoreFailure,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header(
    BuildContext context, {
    required ProductQuery query,
    required BlockState<List<ProductSummary>> results,
    required int total,
    required BlockState<List<Category>> categories,
    required Category? filteredCategory,
  }) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final count = switch (results) {
      BlockLoading() => SearchPage.pendingText,
      BlockFailed() => null,
      BlockLoaded() => formatProductCount(total),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.s8,
          runSpacing: AppSpacing.s8,
          children: [
            AppButton(
              label: SearchPage.filtersButtonLabel(
                ActiveFilterPills.countOf(query),
              ),
              icon: Icons.tune,
              variant: AppButtonVariant.outline,
              size: AppButtonSize.sm,
              onPressed: () => showFiltersSheet(context, _search),
            ),
            AppButton(
              label: productSortLabels[effectiveSort(query)]!,
              icon: Icons.swap_vert,
              variant: AppButtonVariant.outline,
              size: AppButtonSize.sm,
              onPressed: _chooseSort,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.s16),
        Text(
          _title(query, categories, filteredCategory),
          style: textTheme.headlineSmall!.copyWith(color: tokens.ink),
        ),
        if (count != null) ...[
          const SizedBox(height: AppSpacing.s4),
          Text(
            count,
            style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
          ),
        ],
      ],
    );
  }

  /// Busca, categoria ("…" enquanto a árvore carrega), destaques, ofertas ou
  /// "Produtos" (`listingTitle` do web).
  String _title(
    ProductQuery query,
    BlockState<List<Category>> categories,
    Category? filteredCategory,
  ) {
    final search = query.search;
    if (search != null) return SearchPage.searchTitle(search);
    if (query.categorySlug != null) {
      if (filteredCategory != null) return filteredCategory.name;
      return categories is BlockLoading
          ? SearchPage.pendingText
          : SearchPage.defaultTitle;
    }
    if (query.featured) return SearchPage.featuredTitle;
    if (query.onSale) return SearchPage.onSaleTitle;
    return SearchPage.defaultTitle;
  }

  Widget _body({
    required ProductQuery query,
    required BlockState<List<ProductSummary>> results,
    required bool loadingMore,
    required AppFailure? loadMoreFailure,
  }) {
    return switch (results) {
      BlockLoading() => const SliverToBoxAdapter(
        child: ProductGridSkeleton(count: SearchPage.skeletonCount),
      ),
      BlockFailed(:final failure) => SliverToBoxAdapter(
        child: StateErrorBanner(
          title: SearchPage.errorTitle,
          failure: failure,
          onRetry: _search.retry,
        ),
      ),
      BlockLoaded(:final value) when value.isEmpty => SliverToBoxAdapter(
        child: _empty(query),
      ),
      BlockLoaded(:final value) => SliverMainAxisGroup(
        slivers: [
          ProductGrid(products: value, onOpenProduct: widget.onOpenProduct),
          SliverToBoxAdapter(
            child: _footer(
              loadingMore: loadingMore,
              loadMoreFailure: loadMoreFailure,
            ),
          ),
        ],
      ),
    };
  }

  /// Uma ação só: tirar os filtros, senão o termo, senão recarregar.
  Widget _empty(ProductQuery query) {
    final (label, action) = hasCatalogFilters(query)
        ? (SearchPage.clearFiltersAction, _search.clearFilters)
        : query.search != null
        ? (SearchPage.clearSearchAction, _clearSearch)
        : (SearchPage.refreshAction, _search.refresh);

    return EmptyState(
      emoji: '🔎',
      title: SearchPage.emptyTitle,
      message: SearchPage.emptyMessage,
      actionLabel: label,
      onAction: action,
    );
  }

  /// Skeleton de uma linha enquanto a próxima página carrega; o banner com
  /// "Tentar de novo" se ela falhou; nada no fim da lista.
  Widget _footer({
    required bool loadingMore,
    required AppFailure? loadMoreFailure,
  }) {
    if (loadMoreFailure != null) {
      return Padding(
        padding: const EdgeInsets.only(top: AppSpacing.s16),
        child: StateErrorBanner(
          title: SearchPage.loadMoreErrorTitle,
          failure: loadMoreFailure,
          onRetry: _search.retryLoadMore,
        ),
      );
    }
    if (loadingMore) {
      return const Padding(
        padding: EdgeInsets.only(top: AppSpacing.s14),
        child: ProductGridSkeleton(count: SearchPage.footerSkeletonCount),
      );
    }
    return const SizedBox.shrink();
  }
}
