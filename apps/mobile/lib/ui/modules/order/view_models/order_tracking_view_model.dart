import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/order/model/order_entity.dart';
import '../../../../modules/order/provider/order_repository.dart';
import '../../../shared/view_models/block_state.dart';

/// Estado do acompanhamento do pedido: o pedido do id de [start], sempre
/// pedido à API (nunca guardado). Enquanto uma leitura roda, [order] é
/// [BlockLoading]; cada leitura nova descarta a resposta de uma anterior que
/// chegue depois.
///
/// [now] é o relógio do "Feito hoje", injetável nos testes.
class OrderTrackingViewModel extends ChangeNotifier {
  OrderTrackingViewModel(this._repository, {DateTime Function()? now})
    : _now = now ?? DateTime.now;

  final OrderRepository _repository;
  final DateTime Function() _now;

  String _orderId = '';
  int _request = 0;
  bool _disposed = false;
  BlockState<OrderDetail> _order = const BlockLoading();

  BlockState<OrderDetail> get order => _order;

  /// O pedido não existe ou é de outra conta (`404`): a página mostra o
  /// estado vazio, não o banner de falha.
  bool get isNotFound => switch (_order) {
    BlockFailed(:final failure) => failure is NotFoundFailure,
    BlockLoading() || BlockLoaded() => false,
  };

  /// Agora, pelo relógio injetado.
  DateTime now() => _now();

  /// Guarda o [orderId] e pede o pedido.
  Future<void> start(String orderId) {
    _orderId = orderId;
    return load();
  }

  /// Pede o pedido de novo, passando pelo [BlockLoading]; é o "Tentar de
  /// novo" da página.
  Future<void> load() async {
    final request = ++_request;
    _order = const BlockLoading();
    _notify();
    final Result<OrderDetail> result;
    try {
      result = await _repository.findMine(_orderId);
    } catch (_) {
      if (_disposed || request != _request) return;
      _order = const BlockFailed(
        UnexpectedFailure(
          message: 'Algo deu errado. Tente novamente.',
          code: GenericFailureCode.unspecified,
        ),
      );
      _notify();
      return;
    }
    if (_disposed || request != _request) return;
    _order = switch (result) {
      Ok(:final value) => BlockLoaded(value),
      Failure(:final failure) => BlockFailed(failure),
    };
    _notify();
  }

  /// Puxar a tela: a mesma leitura de [load], esperada até o fim pelo
  /// `RefreshIndicator`.
  Future<void> refresh() => load();

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
