import 'dart:async';

import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/category_tree.dart';
import '../../../../modules/catalog/model/product_listing.dart';
import '../../../../modules/catalog/model/product_page_entity.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../../modules/catalog/provider/catalog_repository.dart';
import '../../../shared/view_models/block_state.dart';

/// Estado da aba Buscar: o filtro em vigor, a espera da busca digitada, a
/// listagem paginada e a árvore de categorias do painel de filtros.
///
/// Toda mudança de filtro passa por [normalizeListingQuery]; filtro igual ao
/// em vigor não pede nada. A primeira página não usa [Command0], porque uma
/// troca de filtro no meio do pedido precisa valer: cada pedido leva a
/// geração do filtro, e a resposta de uma geração antiga é descartada (da
/// primeira página e da seguinte).
class SearchViewModel extends ChangeNotifier {
  SearchViewModel(this._repository) {
    loadCategories = Command0<void>(_fetchCategories, onStateChange: _notify);
    loadMore = Command0<void>(_fetchNextPage, onStateChange: _notify);
  }

  final CatalogRepository _repository;

  /// Tempo sem digitação até a busca do campo valer.
  static const searchDelay = Duration(milliseconds: 300);

  /// Busca a árvore de categorias (reaproveitando a guardada, salvo depois de
  /// [refresh]). É o "Tentar de novo" do grupo Categoria do painel.
  late final Command0<void> loadCategories;

  /// Pede a próxima página do filtro em vigor e acrescenta os itens. Não faz
  /// nada sem a primeira página carregada, sem [hasMore] ou com
  /// [loadMoreFailure] pendente (o rodapé pede [retryLoadMore]).
  late final Command0<void> loadMore;

  ProductQuery _query = const ProductQuery();
  String _searchText = '';
  Timer? _searchTimer;
  int _generation = 0;
  bool _refreshCategories = false;
  bool _disposed = false;

  BlockState<List<Category>> _categories = const BlockLoading();
  BlockState<List<ProductSummary>> _results = const BlockLoading();
  List<ProductSummary> _items = const [];
  int _page = 0;
  int _totalPages = 0;
  int _total = 0;
  List<BrandFacet> _brandFacets = const [];
  AppFailure? _loadMoreFailure;

  /// O filtro em vigor, normalizado e sem `page`/`pageSize`.
  ProductQuery get query => _query;

  /// O texto do campo de busca, que pode estar esperando para valer.
  String get searchText => _searchText;

  /// Os itens já carregados, da página 1 até a última pedida; [BlockLoading]
  /// enquanto a página 1 carrega (também ao trocar o filtro).
  BlockState<List<ProductSummary>> get results => _results;

  /// Total de produtos do filtro, da última página recebida.
  int get total => _total;

  /// Marcas do resultado, da última página recebida.
  List<BrandFacet> get brandFacets => _brandFacets;

  /// Há página depois da última carregada.
  bool get hasMore => _results is BlockLoaded && _page < _totalPages;

  /// A página seguinte está sendo pedida.
  bool get loadingMore => loadMore.running;

  /// Falha da página seguinte; os itens já carregados continuam.
  AppFailure? get loadMoreFailure => _loadMoreFailure;

  /// Raízes da árvore, na ordem da API, cada uma com as descendentes dentro.
  BlockState<List<Category>> get categories =>
      loadCategories.running ? const BlockLoading() : _categories;

  /// A categoria do filtro, procurada em toda a árvore; `null` sem categoria,
  /// com a árvore carregando ou falhando, ou com slug desconhecido.
  Category? get filteredCategory {
    final slug = _query.categorySlug;
    if (slug == null) return null;
    return switch (categories) {
      BlockLoaded(:final value) => switch (categoryTrail(value, slug)) {
        [..., final last] => last,
        _ => null,
      },
      BlockLoading() || BlockFailed() => null,
    };
  }

  /// Primeira montagem da aba: categorias e a página 1 de [initial].
  Future<void> start(ProductQuery initial) {
    _searchText = normalizeListingQuery(initial).search ?? '';
    return Future.wait([
      loadCategories.execute(),
      _apply(initial, force: true),
    ]);
  }

  /// Filtro vindo da rota. Igual ao em vigor, não faz nada (nem mexe no
  /// campo); senão, cancela a espera da busca e iguala o campo ao termo.
  Future<void> applyQuery(ProductQuery next) {
    final normalized = normalizeListingQuery(next);
    if (normalized == _query) return Future.value();
    _searchTimer?.cancel();
    _searchText = normalized.search ?? '';
    return _apply(normalized);
  }

  /// Texto digitado: vale depois de [searchDelay] sem nova digitação.
  void onSearchChanged(String text) {
    _searchText = text;
    _searchTimer?.cancel();
    _searchTimer = Timer(
      searchDelay,
      () => _apply(_query.copyWith(search: _searchText)),
    );
    _notify();
  }

  /// Confirmação pelo teclado: vale na hora.
  Future<void> submitSearch(String text) {
    _searchTimer?.cancel();
    _searchText = text;
    _notify();
    return _apply(_query.copyWith(search: text));
  }

  /// "Limpar busca": esvazia o campo e tira o termo na hora.
  Future<void> clearSearch() {
    _searchTimer?.cancel();
    _searchText = '';
    _notify();
    return _apply(_query.copyWith(search: null));
  }

  Future<void> setSort(ProductSort? sort) =>
      _apply(_query.copyWith(sort: sort));

  Future<void> setCategory(String? slug) =>
      _apply(_query.copyWith(categorySlug: slug));

  Future<void> toggleBrand(String slug, bool selected) => _apply(
    _query.copyWith(
      brandSlugs: selected
          ? [..._query.brandSlugs, slug]
          : [..._query.brandSlugs.where((brand) => brand != slug)],
    ),
  );

  Future<void> removeBrand(String slug) => toggleBrand(slug, false);

  Future<void> setPriceRange(int? minCents, int? maxCents) =>
      _apply(_query.copyWith(minPriceCents: minCents, maxPriceCents: maxCents));

  Future<void> clearPrice() => setPriceRange(null, null);

  Future<void> setOnSale(bool value) => _apply(_query.copyWith(onSale: value));

  Future<void> setFeatured(bool value) =>
      _apply(_query.copyWith(featured: value));

  /// Tira categoria, marcas, preço, ofertas e destaques; mantém busca e ordem.
  Future<void> clearFilters() => _apply(clearCatalogFilters(_query));

  /// "Tentar de novo" da grade: a página 1 do mesmo filtro.
  Future<void> retry() => _restart();

  /// "Tentar de novo" do rodapé: a mesma página seguinte, de novo.
  Future<void> retryLoadMore() {
    _loadMoreFailure = null;
    return loadMore.execute();
  }

  /// Puxar a tela: categorias sem reaproveitar a árvore e a página 1 do mesmo
  /// filtro.
  Future<void> refresh() {
    _refreshCategories = true;
    return Future.wait([loadCategories.execute(), _restart()]);
  }

  @override
  void dispose() {
    _disposed = true;
    _searchTimer?.cancel();
    super.dispose();
  }

  Future<void> _apply(ProductQuery next, {bool force = false}) {
    final normalized = normalizeListingQuery(next);
    if (!force && normalized == _query) return Future.value();
    _query = normalized;
    return _restart();
  }

  /// Nova geração: esquece os itens e pede a página 1 do filtro em vigor.
  Future<void> _restart() async {
    final generation = ++_generation;
    final query = _query;
    _items = const [];
    _page = 0;
    _totalPages = 0;
    _total = 0;
    _brandFacets = const [];
    _loadMoreFailure = null;
    _results = const BlockLoading();
    _notify();

    final result = await _fetchPage(query, 1);
    if (_disposed || generation != _generation) return;
    switch (result) {
      case Ok(:final value):
        _receive(value, 1);
      case Failure(:final failure):
        _results = BlockFailed(failure);
    }
    _notify();
  }

  Future<Result<void>> _fetchNextPage() async {
    if (_results is! BlockLoaded || !hasMore || _loadMoreFailure != null) {
      return const Ok(null);
    }
    final generation = _generation;
    final page = _page + 1;
    final result = await _fetchPage(_query, page);
    if (_disposed || generation != _generation) return const Ok(null);
    switch (result) {
      case Ok(:final value):
        _receive(value, page);
        return const Ok(null);
      case Failure(:final failure):
        _loadMoreFailure = failure;
        return Failure(failure);
    }
  }

  Future<Result<ProductPage>> _fetchPage(ProductQuery query, int page) async {
    try {
      return await _repository.fetchProducts(listingPageQuery(query, page));
    } catch (_) {
      return const Failure(unspecifiedFailure);
    }
  }

  /// Acrescenta os itens da página [number], pulando `id` já presente (o
  /// catálogo pode mudar entre páginas).
  void _receive(ProductPage page, int number) {
    final ids = {for (final item in _items) item.id};
    _items = List.unmodifiable([
      ..._items,
      ...page.items.where((item) => ids.add(item.id)),
    ]);
    _page = number;
    _totalPages = page.totalPages;
    _total = page.total;
    _brandFacets = List.unmodifiable(page.brandFacets);
    _results = BlockLoaded(_items);
  }

  Future<Result<void>> _fetchCategories() async {
    final refresh = _refreshCategories;
    _refreshCategories = false;
    final result = await _repository.fetchCategories(refresh: refresh);
    switch (result) {
      case Ok(:final value):
        _categories = BlockLoaded(List.unmodifiable(value));
        return const Ok(null);
      case Failure(:final failure):
        _categories = BlockFailed(failure);
        return Failure(failure);
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
