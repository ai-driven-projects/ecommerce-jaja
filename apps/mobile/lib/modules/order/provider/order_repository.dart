import '../../../core/result.dart';
import '../model/order_entity.dart';
import '../model/placed_order.dart';

/// Pedidos do usuário da sessão: o fechamento e a leitura de um pedido.
abstract interface class OrderRepository {
  /// Fecha o pedido com o carrinho da conta, que o servidor esvazia. Os
  /// textos vão como digitados: quem apara e valida é o servidor. As recusas
  /// voltam como falha HTTP, com os códigos (`OrderErrorCode`).
  Future<Result<PlacedOrder>> placeOrder({
    required String recipientName,
    required String deliveryInstructions,
  });

  /// Lê o pedido [id] da conta. Pedido inexistente ou de outra conta volta
  /// como `NotFoundFailure`.
  Future<Result<OrderDetail>> findMine(String id);
}
