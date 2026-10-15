import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/command.dart';
import '../../../../core/result.dart';
import '../../../../modules/catalog/model/category_entity.dart';
import '../../../../modules/catalog/model/home_catalog.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../../modules/catalog/provider/catalog_repository.dart';
import 'block_state.dart';

/// Estado da aba Início: três blocos remotos independentes (categorias,
/// destaques e ofertas), cada um com o próprio command. O último resultado de
/// cada bloco vive em campo próprio; enquanto o command roda, o bloco é
/// [BlockLoading], também quando já havia dado (skeleton na recarga).
class HomeViewModel extends ChangeNotifier {
  HomeViewModel(this._repository) {
    loadCategories = Command0<void>(
      _fetchCategories,
      onStateChange: notifyListeners,
    );
    loadFeatured = Command0<void>(
      () => _fetchProducts(homeFeaturedQuery, (block) => _featured = block),
      onStateChange: notifyListeners,
    );
    loadOffers = Command0<void>(
      () => _fetchProducts(homeOffersQuery, (block) => _offers = block),
      onStateChange: notifyListeners,
    );
  }

  final CatalogRepository _repository;

  /// Busca a árvore de categorias (reaproveitando a guardada, salvo depois de
  /// [refresh]). É o "Tentar de novo" do bloco das categorias.
  late final Command0<void> loadCategories;

  /// Busca "Em destaque"; é o "Tentar de novo" desse bloco.
  late final Command0<void> loadFeatured;

  /// Busca "Ofertas da semana"; é o "Tentar de novo" desse bloco.
  late final Command0<void> loadOffers;

  BlockState<List<Category>> _categories = const BlockLoading();
  BlockState<List<ProductSummary>> _featured = const BlockLoading();
  BlockState<List<ProductSummary>> _offers = const BlockLoading();
  bool _refreshCategories = false;

  /// Raízes da árvore, na ordem da API, cada uma com as descendentes dentro.
  BlockState<List<Category>> get categories =>
      loadCategories.running ? const BlockLoading() : _categories;

  BlockState<List<ProductSummary>> get featured =>
      loadFeatured.running ? const BlockLoading() : _featured;

  BlockState<List<ProductSummary>> get offers =>
      loadOffers.running ? const BlockLoading() : _offers;

  /// "Categorias em destaque", até o limite da Início; vazia enquanto as
  /// categorias não estão carregadas.
  List<HighlightedCategory> get highlighted => switch (categories) {
    BlockLoaded(:final value) => highlightedCategories(
      value,
      homeHighlightedCategoriesLimit,
    ),
    BlockLoading() || BlockFailed() => const [],
  };

  /// Os três blocos carregados e sem nada: a tela troca as seções pelo estado
  /// vazio único.
  bool get isEverythingEmpty =>
      _isLoadedEmpty(categories) &&
      _isLoadedEmpty(featured) &&
      _isLoadedEmpty(offers);

  /// Primeira carga: os três blocos em paralelo.
  Future<void> loadAll() => Future.wait([
    loadCategories.execute(),
    loadFeatured.execute(),
    loadOffers.execute(),
  ]);

  /// Puxar a tela: refaz os três, sem reaproveitar a árvore guardada.
  Future<void> refresh() {
    _refreshCategories = true;
    return loadAll();
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

  Future<Result<void>> _fetchProducts(
    ProductQuery query,
    void Function(BlockState<List<ProductSummary>> block) store,
  ) async {
    final result = await _repository.fetchProducts(query);
    switch (result) {
      case Ok(:final value):
        store(BlockLoaded(List.unmodifiable(value.items)));
        return const Ok(null);
      case Failure(:final failure):
        store(BlockFailed(failure));
        return Failure(failure);
    }
  }

  static bool _isLoadedEmpty(BlockState<List<Object>> block) =>
      block is BlockLoaded<List<Object>> && block.value.isEmpty;
}
