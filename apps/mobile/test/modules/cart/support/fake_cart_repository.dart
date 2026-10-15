import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_rules.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/modules/cart/provider/cart_repository.dart';

/// Quantidade recebida por um `add` ou `setQuantity`.
typedef CartQuantityCall = ({String productId, int quantity});

/// [CartRepository] em memória para os testes de ViewModel, de página e de
/// rota, sem rede nem disco. Começa com [state] (padrão: vazio, restaurado).
///
/// Cada `add` consome a próxima resposta de [enqueueAdd] ou [holdAdd]; cada
/// `setQuantity`, a próxima de [enqueueSetQuantity]. Com a fila vazia, ambos
/// devolvem `Ok`. No `Ok`, a mudança é aplicada aos itens pelas regras de
/// `cart_rules.dart` (que ainda podem recusar), avisa os ouvintes e emite em
/// [changes], para o badge e o "Você já tem" mudarem nos testes; o `remove`
/// também. As linhas da prévia ([CartState.detail]) só mudam por [emit].
/// [addCalls], [setQuantityCalls], [removeCalls] e [refreshCalls] gravam as
/// chamadas, na ordem.
class FakeCartRepository extends ChangeNotifier implements CartRepository {
  FakeCartRepository({CartState? state}) : _state = state ?? CartState();

  final List<CartQuantityCall> addCalls = [];
  final List<CartQuantityCall> setQuantityCalls = [];
  final List<String> removeCalls = [];
  int refreshCalls = 0;

  final Queue<Future<Result<void>>> _addResponses = Queue();
  final Queue<Future<Result<void>>> _setQuantityResponses = Queue();
  final StreamController<CartState> _changes = StreamController.broadcast();

  CartState _state;

  @override
  CartState get state => _state;

  @override
  Stream<CartState> get changes => _changes.stream;

  void enqueueAdd(Result<void> result) {
    _addResponses.add(Future.value(result));
  }

  void enqueueSetQuantity(Result<void> result) {
    _setQuantityResponses.add(Future.value(result));
  }

  /// Segura o próximo `add` até o teste completar o [Completer], para
  /// observar o estado "Adicionando…".
  Completer<Result<void>> holdAdd() {
    final completer = Completer<Result<void>>();
    _addResponses.add(completer.future);
    return completer;
  }

  /// Troca o estado como uma mudança feita por fora (outra tela, a prévia),
  /// avisando os ouvintes e emitindo em [changes].
  void emit(CartState state) {
    _state = state;
    notifyListeners();
    _changes.add(state);
  }

  @override
  Future<Result<void>> add(String productId, int quantity) {
    addCalls.add((productId: productId, quantity: quantity));
    return _settle(
      _addResponses,
      (items) => addCartItem(items, productId, quantity),
    );
  }

  @override
  Future<Result<void>> setQuantity(String productId, int quantity) {
    setQuantityCalls.add((productId: productId, quantity: quantity));
    return _settle(
      _setQuantityResponses,
      (items) => setCartItemQuantity(items, productId, quantity),
    );
  }

  @override
  Future<void> remove(String productId) async {
    removeCalls.add(productId);
    _apply(removeCartItem(_state.items, productId));
  }

  @override
  void refresh() => refreshCalls++;

  Future<Result<void>> _settle(
    Queue<Future<Result<void>>> responses,
    Result<List<CartItem>> Function(List<CartItem> items) rule,
  ) async {
    final result = await (responses.isEmpty
        ? Future.value(const Ok<void>(null))
        : responses.removeFirst());
    if (result is Failure) return result;
    switch (rule(_state.items)) {
      case Ok(:final value):
        _apply(value);
        return const Ok(null);
      case Failure(:final failure):
        return Failure(failure);
    }
  }

  void _apply(List<CartItem> items) => emit(_state.copyWith(items: items));

  @override
  void dispose() {
    _changes.close();
    super.dispose();
  }
}
