import 'dart:async';
import 'dart:collection';

import 'package:mobile/core/result.dart';
import 'package:mobile/modules/order/model/order_entity.dart';
import 'package:mobile/modules/order/model/placed_order.dart';
import 'package:mobile/modules/order/provider/order_repository.dart';

import 'order_fixtures.dart';

/// Pedido de `placeOrder` recebido pelo [FakeOrderRepository].
typedef PlaceOrderCall = ({String recipientName, String deliveryInstructions});

/// Id do pedido que o [FakeOrderRepository] cria com a fila vazia; o número
/// exibido é `3F1C9A52`.
const fakePlacedOrderId = '3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f';

/// [OrderRepository] em memória para os testes de ViewModel, página e rota,
/// sem rede.
///
/// Cada `placeOrder` consome a próxima resposta de [enqueuePlace] ou
/// [holdPlace]; com a fila vazia, devolve `Ok(PlacedOrder(placedId))`.
/// [placeCalls] guarda cada pedido recebido, na ordem.
///
/// Cada `findMine` consome a próxima resposta de [enqueueFind] ou [holdFind];
/// com a fila vazia, devolve `Ok(fakeOrderDetail(id: <id pedido>))`.
/// [findCalls] guarda cada id pedido, na ordem.
class FakeOrderRepository implements OrderRepository {
  FakeOrderRepository({this.placedId = fakePlacedOrderId});

  /// Id do pedido criado quando a fila está vazia.
  String placedId;

  final List<PlaceOrderCall> placeCalls = [];

  final Queue<Future<Result<PlacedOrder>>> _placeResponses = Queue();

  final List<String> findCalls = [];

  final Queue<Future<Result<OrderDetail>>> _findResponses = Queue();

  void enqueuePlace(Result<PlacedOrder> result) {
    _placeResponses.add(Future.value(result));
  }

  /// Segura o próximo `placeOrder` até o teste completar o [Completer], para
  /// observar o "Confirmando…".
  Completer<Result<PlacedOrder>> holdPlace() {
    final completer = Completer<Result<PlacedOrder>>();
    _placeResponses.add(completer.future);
    return completer;
  }

  @override
  Future<Result<PlacedOrder>> placeOrder({
    required String recipientName,
    required String deliveryInstructions,
  }) {
    placeCalls.add((
      recipientName: recipientName,
      deliveryInstructions: deliveryInstructions,
    ));
    if (_placeResponses.isNotEmpty) return _placeResponses.removeFirst();
    return Future.value(Ok(PlacedOrder(placedId)));
  }

  void enqueueFind(Result<OrderDetail> result) {
    _findResponses.add(Future.value(result));
  }

  /// Segura o próximo `findMine` até o teste completar o [Completer], para
  /// observar o carregamento ou a resposta fora de ordem.
  Completer<Result<OrderDetail>> holdFind() {
    final completer = Completer<Result<OrderDetail>>();
    _findResponses.add(completer.future);
    return completer;
  }

  @override
  Future<Result<OrderDetail>> findMine(String id) {
    findCalls.add(id);
    if (_findResponses.isNotEmpty) return _findResponses.removeFirst();
    return Future.value(Ok(fakeOrderDetail(id: id)));
  }
}
