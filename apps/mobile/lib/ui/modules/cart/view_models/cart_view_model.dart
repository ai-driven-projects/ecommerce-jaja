import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../core/command.dart';
import '../../../../core/result.dart';
import '../../../../modules/cart/model/cart_state.dart';
import '../../../../modules/cart/provider/cart_repository.dart';

/// Quantidade pedida para um produto da aba Carrinho.
typedef CartQuantityChange = ({String productId, int quantity});

/// Estado da aba Carrinho e do badge da barra: o [state] do repositório,
/// acompanhando cada mudança, e as ações das linhas. [failureMessage] guarda a
/// mensagem da última ação que falhou (para o `SnackBar`) e é limpa quando
/// outra ação começa.
class CartViewModel extends ChangeNotifier {
  CartViewModel(this._repository) : _state = _repository.state {
    changeQuantity = Command1<void, CartQuantityChange>(
      _changeQuantity,
      onStateChange: _notify,
    );
    remove = Command1<void, String>(_remove, onStateChange: _notify);
    _subscription = _repository.changes.listen(_onChanged);
  }

  final CartRepository _repository;

  /// Define a quantidade do produto; 0 o remove.
  late final Command1<void, CartQuantityChange> changeQuantity;

  /// Tira o produto do carrinho.
  late final Command1<void, String> remove;

  late final StreamSubscription<CartState> _subscription;
  CartState _state;
  String? _failureMessage;
  bool _disposed = false;

  CartState get state => _state;

  String? get failureMessage => _failureMessage;

  /// O "Tentar de novo" do banner: pede a prévia na hora.
  void retry() => _repository.refresh();

  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription.cancel());
    super.dispose();
  }

  void _onChanged(CartState state) {
    _state = state;
    _notify();
  }

  Future<Result<void>> _changeQuantity(CartQuantityChange change) async {
    _failureMessage = null;
    final result = await _repository.setQuantity(
      change.productId,
      change.quantity,
    );
    if (result case Failure(:final failure)) {
      _failureMessage = failure.message;
    }
    return result;
  }

  Future<Result<void>> _remove(String productId) async {
    _failureMessage = null;
    final result = await _repository.remove(productId);
    if (result case Failure(:final failure)) {
      _failureMessage = failure.message;
    }
    return result;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
