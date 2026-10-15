import 'dart:async';

import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/catalog/model/product_detail.dart';
import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../../modules/catalog/model/product_page_entity.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../../modules/catalog/provider/catalog_repository.dart';
import 'block_state.dart';

/// Estado da página do produto: o detalhe pelo slug e, depois dele, "Mais de
/// `<categoria>`". O detalhe é sempre pedido à API (nunca guardado); enquanto
/// [load] roda, [product] é [BlockLoading]. Os relacionados não bloqueiam a
/// página e, se falharem, ficam vazios sem banner (a seção some, como no web).
class ProductDetailViewModel extends ChangeNotifier {
  ProductDetailViewModel(this._repository) {
    load = Command0<void>(_fetchProduct, onStateChange: _notify);
  }

  final CatalogRepository _repository;

  /// Pede o produto do slug de [start]; é o "Tentar de novo" da página.
  late final Command0<void> load;

  String _slug = '';
  int _generation = 0;
  bool _disposed = false;
  BlockState<ProductDetail> _product = const BlockLoading();
  List<ProductSummary> _related = const [];

  BlockState<ProductDetail> get product =>
      load.running ? const BlockLoading() : _product;

  /// O produto não existe (`404`): a página mostra o estado vazio, não o
  /// banner de falha.
  bool get isNotFound => switch (product) {
    BlockFailed(:final failure) => failure is NotFoundFailure,
    BlockLoading() || BlockLoaded() => false,
  };

  /// "Mais de `<categoria>`", sem o próprio produto; vazia até chegar, sem
  /// categoria ou com o pedido em falha.
  List<ProductSummary> get related => _related;

  /// Guarda o [slug] e pede o produto.
  Future<void> start(String slug) {
    _slug = slug;
    return load.execute();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  Future<Result<void>> _fetchProduct() async {
    final generation = ++_generation;
    _related = const [];
    final result = await _repository.fetchProduct(_slug);
    switch (result) {
      case Ok(:final value):
        _product = BlockLoaded(value);
        unawaited(_fetchRelated(value, generation));
        return const Ok(null);
      case Failure(:final failure):
        _product = BlockFailed(failure);
        return Failure(failure);
    }
  }

  /// Pede os relacionados sem segurar a página; resposta de uma carga antiga
  /// é descartada.
  Future<void> _fetchRelated(ProductDetail product, int generation) async {
    final query = relatedProductsQuery(product);
    if (query == null) return;
    final Result<ProductPage> result;
    try {
      result = await _repository.fetchProducts(query);
    } catch (_) {
      return;
    }
    if (_disposed || generation != _generation) return;
    if (result case Ok(:final value)) {
      _related = relatedProducts(value.items, product.id);
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
