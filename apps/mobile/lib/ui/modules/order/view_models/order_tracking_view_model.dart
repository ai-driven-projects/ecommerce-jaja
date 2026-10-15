import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/order/model/order_entity.dart';
import '../../../../modules/order/model/order_live_status.dart';
import '../../../../modules/order/model/order_progress.dart';
import '../../../../modules/order/model/order_status.dart';
import '../../../../modules/order/provider/order_repository.dart';
import '../../../../modules/order/usecase/live_order_feed.dart';
import '../../../shared/view_models/block_state.dart';

/// Estado do acompanhamento do pedido: o pedido do id de [start], sempre
/// pedido à API (nunca guardado). Enquanto uma leitura de [load] roda,
/// [order] é [BlockLoading]; cada leitura nova descarta a resposta de uma
/// anterior que chegue depois.
///
/// Com um pedido não entregue na tela e a tela ativa ([setActive]), mantém
/// aberto o stream de avisos do [LiveOrderFeed] (situação em [live]) e relê o
/// pedido em silêncio a cada aviso e a cada conexão, como `use-my-order.hook.ts`
/// do web: sem [BlockLoading], com no máximo uma releitura em andamento e uma
/// pendente (`createCoalescedRead`).
///
/// [now] é o relógio do "Feito hoje", injetável nos testes.
class OrderTrackingViewModel extends ChangeNotifier {
  OrderTrackingViewModel(
    this._repository,
    this._feed, {
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final OrderRepository _repository;
  final LiveOrderFeed _feed;
  final DateTime Function() _now;

  String _orderId = '';

  /// Vale para [load] e para a releitura silenciosa: a resposta de uma
  /// leitura antiga nunca sobrescreve a de uma mais nova.
  int _request = 0;
  bool _disposed = false;
  bool _active = true;

  /// Uma leitura de [load] está em andamento: a releitura silenciosa é pulada.
  bool _loading = false;
  bool _refetching = false;
  bool _refetchPending = false;
  BlockState<OrderDetail> _order = const BlockLoading();
  OrderLiveStatus _live = OrderLiveStatus.off;
  OrderStatus? _openedStatus;

  BlockState<OrderDetail> get order => _order;

  /// Situação do stream de avisos; [OrderLiveStatus.off] sem stream.
  OrderLiveStatus get live => _live;

  /// Status da primeira leitura bem-sucedida: o pedido como a tela abriu.
  OrderStatus? get openedStatus => _openedStatus;

  /// O pedido não existe ou é de outra conta (`404`): a página mostra o
  /// estado vazio, não o banner de falha.
  bool get isNotFound => switch (_order) {
    BlockFailed(:final failure) => failure is NotFoundFailure,
    BlockLoading() || BlockLoaded() => false,
  };

  /// `true` para o passo [step] concluído depois do status com que a tela
  /// abriu ([openedStatus]): é o passo que recebe o destaque.
  bool isHighlighted(OrderStatus step) {
    final opened = _openedStatus;
    final current = _order;
    if (opened == null || current is! BlockLoaded<OrderDetail>) return false;
    return orderStepState(current.value.status, step) == OrderStepState.done &&
        step.index > opened.index;
  }

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
    _loading = true;
    _order = const BlockLoading();
    _notify();
    final Result<OrderDetail> result;
    try {
      result = await _repository.findMine(_orderId);
    } catch (_) {
      if (_disposed || request != _request) return;
      _loading = false;
      _order = const BlockFailed(unspecifiedFailure);
      _notify();
      return;
    }
    if (_disposed || request != _request) return;
    _loading = false;
    switch (result) {
      case Ok(:final value):
        _openedStatus ??= value.status;
        _order = BlockLoaded(value);
        _notify();
        _syncLive(value);
      case Failure(:final failure):
        _order = BlockFailed(failure);
        _notify();
        if (failure is NotFoundFailure) _closeLive();
    }
  }

  /// Puxar a tela: a mesma leitura de [load], esperada até o fim pelo
  /// `RefreshIndicator`.
  Future<void> refresh() => load();

  /// A tela está visível ([active]) ou não (outra aba, app em segundo
  /// plano). `false` fecha o stream e descarta a releitura pendente; `true`
  /// reabre se houver pedido não entregue na tela.
  void setActive(bool active) {
    if (_disposed || active == _active) return;
    _active = active;
    if (!active) {
      _closeLive();
      return;
    }
    final current = _order;
    if (current is BlockLoaded<OrderDetail>) _syncLive(current.value);
  }

  @override
  void dispose() {
    _disposed = true;
    _feed.stop();
    super.dispose();
  }

  /// Abre o stream para um pedido não entregue, se ele está desligado e a
  /// tela ativa; fecha para um pedido entregue. [OrderLiveStatus.closed] não
  /// reabre aqui: só com a próxima ativação.
  void _syncLive(OrderDetail detail) {
    if (isOrderFinished(detail.status)) {
      _closeLive();
      return;
    }
    if (_disposed || !_active || _live != OrderLiveStatus.off) return;
    _feed.start(_orderId, onStatus: _onLiveStatus, onNotice: _refetch);
  }

  void _closeLive() {
    _feed.stop();
    _refetchPending = false;
    if (_live == OrderLiveStatus.off) return;
    _live = OrderLiveStatus.off;
    _notify();
  }

  void _onLiveStatus(OrderLiveStatus status) {
    if (_disposed) return;
    _live = status;
    _notify();
    if (status == OrderLiveStatus.live) _refetch();
  }

  /// Releitura silenciosa e coalescida: com uma em andamento, os pedidos
  /// seguintes viram uma pendente, feita quando ela termina.
  void _refetch() {
    if (_disposed || _loading) return;
    if (_refetching) {
      _refetchPending = true;
      return;
    }
    _runRefetch();
  }

  Future<void> _runRefetch() async {
    _refetching = true;
    do {
      _refetchPending = false;
      final request = ++_request;
      Result<OrderDetail>? result;
      try {
        result = await _repository.findMine(_orderId);
      } catch (_) {
        result = null;
      }
      if (_disposed) return;
      if (result != null && request == _request) _applyRefetch(result);
    } while (_refetchPending && !_loading);
    _refetching = false;
  }

  /// Sucesso troca o pedido; `404` vira o estado de não encontrado e fecha o
  /// stream; outra falha fica em silêncio, com o pedido na tela.
  void _applyRefetch(Result<OrderDetail> result) {
    switch (result) {
      case Ok(:final value):
        _openedStatus ??= value.status;
        _order = BlockLoaded(value);
        _notify();
        _syncLive(value);
      case Failure(:final failure) when failure is NotFoundFailure:
        _order = BlockFailed(failure);
        _notify();
        _closeLive();
      case Failure():
        break;
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
