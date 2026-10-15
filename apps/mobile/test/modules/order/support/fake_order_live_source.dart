import 'dart:async';

import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/modules/order/provider/order_live_source.dart';

/// Uma conexão aberta pelo [FakeOrderLiveSource]: o teste decide o que o
/// servidor manda com [opened], [notice], [refuse] e [drop].
class FakeOrderConnection {
  FakeOrderConnection(this.orderId) {
    _controller = StreamController<OrderStreamSignal>(
      onCancel: () => isCancelled = true,
    );
  }

  final String orderId;

  late final StreamController<OrderStreamSignal> _controller;

  /// `true` depois que quem assinou cancelou a assinatura (fechou a conexão).
  bool isCancelled = false;

  /// `true` depois que o servidor encerrou a conexão ([refuse] ou [drop]).
  bool get isClosed => _controller.isClosed;

  Stream<OrderStreamSignal> get stream => _controller.stream;

  /// A resposta `200`.
  void opened() => _controller.add(const OrderStreamOpened());

  /// Um evento `order`.
  void notice() => _controller.add(const OrderStreamNotice());

  /// Recusa `401`/`403`/`404` com [failure], seguida do fim do stream.
  void refuse(AppFailure failure) {
    _controller.add(OrderStreamRefused(failure));
    _controller.close();
  }

  /// Queda: o stream termina sem recusa.
  void drop() => _controller.close();
}

/// [OrderLiveSource] em memória para os testes do feed, do ViewModel, da
/// página e da rota, sem rede.
///
/// Cada `open` cria uma [FakeOrderConnection], guardada em [connections] na
/// ordem; sem comando do teste, ela fica aberta sem eventos.
class FakeOrderLiveSource implements OrderLiveSource {
  final List<FakeOrderConnection> connections = [];

  /// A conexão mais recente.
  FakeOrderConnection get last => connections.last;

  @override
  Stream<OrderStreamSignal> open(String orderId) {
    final connection = FakeOrderConnection(orderId);
    connections.add(connection);
    return connection.stream;
  }
}
