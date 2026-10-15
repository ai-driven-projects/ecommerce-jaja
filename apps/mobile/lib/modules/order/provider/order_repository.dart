import '../../../core/result.dart';
import '../model/placed_order.dart';

/// Pedidos do usuário da sessão. A etapa 13 acrescenta a leitura do pedido.
abstract interface class OrderRepository {
  /// Fecha o pedido com o carrinho da conta, que o servidor esvazia. Os
  /// textos vão como digitados: quem apara e valida é o servidor. As recusas
  /// voltam como falha HTTP, com os códigos (`OrderErrorCode`).
  Future<Result<PlacedOrder>> placeOrder({
    required String recipientName,
    required String deliveryInstructions,
  });
}
