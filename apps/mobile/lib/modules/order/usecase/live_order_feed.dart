import 'dart:async';

import '../model/order_live_status.dart';
import '../provider/order_live_source.dart';

// Reconexão copiada de `openEventStream` e `retryDelayMs`
// (`apps/frontend/src/shared/utils/event-stream.util.ts`).

/// Espera antes da tentativa [attempt] (a partir de 0): 1 s, 2 s, 4 s, 8 s e
/// 10 s daí em diante.
Duration orderStreamRetryDelay(int attempt) =>
    Duration(seconds: attempt >= 4 ? 10 : 1 << attempt);

/// Mantém aberta a conexão de avisos de um pedido: reconecta depois de cada
/// queda, com a espera de [orderStreamRetryDelay], e para na recusa do
/// servidor ([OrderLiveStatus.closed]).
///
/// [wait] é o relógio das esperas, injetável nos testes (padrão:
/// `Future.delayed`).
final class LiveOrderFeed {
  LiveOrderFeed(this._source, {Future<void> Function(Duration)? wait})
    : _wait = wait ?? Future<void>.delayed;

  final OrderLiveSource _source;
  final Future<void> Function(Duration) _wait;

  /// Invalida assinatura e espera de um [start] anterior: um `Future` não se
  /// cancela, então a espera confere a geração ao terminar.
  int _generation = 0;
  int _attempt = 0;
  OrderLiveStatus? _status;
  StreamSubscription<OrderStreamSignal>? _subscription;

  /// Abre o stream do pedido [orderId]. [onStatus] recebe cada mudança de
  /// situação (nunca a mesma duas vezes seguidas) e [onNotice], cada aviso de
  /// que o pedido mudou. Um [start] com o feed ligado recomeça do zero.
  void start(
    String orderId, {
    required void Function(OrderLiveStatus status) onStatus,
    required void Function() onNotice,
  }) {
    stop();
    final generation = _generation;
    _attempt = 0;

    void setStatus(OrderLiveStatus status) {
      if (generation != _generation || status == _status) return;
      _status = status;
      onStatus(status);
    }

    late void Function() connect;

    Future<void> retry() async {
      setStatus(OrderLiveStatus.reconnecting);
      await _wait(orderStreamRetryDelay(_attempt));
      if (generation != _generation) return;
      _attempt++;
      connect();
    }

    connect = () {
      var refused = false;
      _subscription = _source
          .open(orderId)
          .listen(
            (signal) {
              if (generation != _generation) return;
              switch (signal) {
                case OrderStreamOpened():
                  _attempt = 0;
                  setStatus(OrderLiveStatus.live);
                case OrderStreamNotice():
                  onNotice();
                case OrderStreamRefused():
                  refused = true;
                  setStatus(OrderLiveStatus.closed);
              }
            },
            onDone: () {
              if (generation != _generation) return;
              _subscription = null;
              if (!refused) retry();
            },
          );
    };

    setStatus(OrderLiveStatus.connecting);
    connect();
  }

  /// Fecha a conexão e invalida a espera em curso; depois dele nenhum
  /// callback do [start] anterior é chamado.
  void stop() {
    _generation++;
    _status = null;
    _attempt = 0;
    final subscription = _subscription;
    _subscription = null;
    subscription?.cancel();
  }
}
