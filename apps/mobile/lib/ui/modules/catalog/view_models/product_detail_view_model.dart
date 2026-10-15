import 'dart:async';

import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../core/value_objects/money.dart';
import '../../../../modules/cart/model/cart_rules.dart';
import '../../../../modules/cart/model/cart_state.dart';
import '../../../../modules/cart/provider/cart_repository.dart';
import '../../../../modules/catalog/model/product_detail.dart';
import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../../modules/catalog/model/product_page_entity.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../../modules/catalog/provider/catalog_repository.dart';
import 'block_state.dart';

/// O que foi incluído no carrinho, para o aviso "Adicionado ao carrinho".
typedef AddedToCart = ({int quantity, Money total});

/// Estado da página do produto: o detalhe pelo slug e, depois dele, "Mais de
/// `<categoria>`". O detalhe é sempre pedido à API (nunca guardado); enquanto
/// [load] roda, [product] é [BlockLoading]. Os relacionados não bloqueiam a
/// página e, se falharem, ficam vazios sem banner (a seção some, como no web).
///
/// O rodapé inclui o produto no carrinho: [quantity] vai de 1 a 99 e
/// [addToCart] a soma ao carrinho; [inCart] acompanha o carrinho.
class ProductDetailViewModel extends ChangeNotifier {
  ProductDetailViewModel(this._repository, this._cart)
    : _cartState = _cart.state {
    load = Command0<void>(_fetchProduct, onStateChange: _notify);
    addToCart = Command0<AddedToCart>(_addToCart, onStateChange: _notify);
    _cartSubscription = _cart.changes.listen(_onCartChanged);
  }

  final CatalogRepository _repository;
  final CartRepository _cart;

  /// Pede o produto do slug de [start]; é o "Tentar de novo" da página.
  late final Command0<void> load;

  /// Soma [quantity] do produto carregado ao carrinho. No sucesso, [quantity]
  /// volta a 1 e o resultado leva a quantidade e o total para o aviso.
  late final Command0<AddedToCart> addToCart;

  late final StreamSubscription<CartState> _cartSubscription;
  CartState _cartState;
  int _quantity = 1;

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

  /// Quantidade a incluir, de 1 a `cartItemMaxQuantity`.
  int get quantity => _quantity;

  bool get canDecrement => _quantity > 1;

  bool get canIncrement => _quantity < cartItemMaxQuantity;

  void increment() => _setQuantity(_quantity + 1);

  void decrement() => _setQuantity(_quantity - 1);

  /// Quantidade do produto carregado já no carrinho; 0 antes do produto.
  int get inCart => switch (product) {
    BlockLoaded(:final value) => _cartState.quantityOf(value.id),
    BlockLoading() || BlockFailed() => 0,
  };

  /// Total da [quantity] escolhida; `null` antes do produto.
  Money? get total => switch (product) {
    BlockLoaded(:final value) => value.price.times(_quantity),
    BlockLoading() || BlockFailed() => null,
  };

  /// Guarda o [slug] e pede o produto.
  Future<void> start(String slug) {
    _slug = slug;
    return load.execute();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_cartSubscription.cancel());
    super.dispose();
  }

  void _setQuantity(int quantity) {
    final next = quantity.clamp(1, cartItemMaxQuantity);
    if (next == _quantity) return;
    _quantity = next;
    _notify();
  }

  void _onCartChanged(CartState state) {
    _cartState = state;
    _notify();
  }

  Future<Result<AddedToCart>> _addToCart() async {
    final current = _product;
    if (current is! BlockLoaded<ProductDetail>) {
      return const Failure(
        UnexpectedFailure(
          message: 'Algo deu errado. Tente novamente.',
          code: GenericFailureCode.unspecified,
        ),
      );
    }
    final product = current.value;
    final quantity = _quantity;
    final result = await _cart.add(product.id, quantity);
    switch (result) {
      case Ok():
        _quantity = 1;
        return Ok((quantity: quantity, total: product.price.times(quantity)));
      case Failure(:final failure):
        return Failure(failure);
    }
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
