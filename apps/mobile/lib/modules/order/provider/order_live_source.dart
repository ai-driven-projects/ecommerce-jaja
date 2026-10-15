import '../../../core/errors/app_failure.dart';

/// Avisos ao vivo de um pedido do usuário da sessão (`GET
/// /me/orders/:id/stream`). Os avisos nunca trazem o pedido: dizem só que ele
/// mudou.
abstract interface class OrderLiveSource {
  /// Abre uma conexão para o pedido [orderId]; cada chamada é uma conexão.
  ///
  /// O stream nunca emite erro: termina depois de [OrderStreamRefused]
  /// (recusa) ou sem ele (queda). Cancelar a assinatura fecha a conexão.
  Stream<OrderStreamSignal> open(String orderId);
}

/// O que uma conexão de [OrderLiveSource] informa.
sealed class OrderStreamSignal {
  const OrderStreamSignal();
}

/// A conexão abriu (resposta `200`).
final class OrderStreamOpened extends OrderStreamSignal {
  const OrderStreamOpened();
}

/// O pedido mudou (um evento `order`).
final class OrderStreamNotice extends OrderStreamSignal {
  const OrderStreamNotice();
}

/// O servidor recusou a conexão (`401`, `403` ou `404`), com a [failure]
/// mapeada; o stream termina em seguida.
final class OrderStreamRefused extends OrderStreamSignal {
  const OrderStreamRefused(this.failure);

  final AppFailure failure;
}
