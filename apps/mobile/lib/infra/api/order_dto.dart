import '../../modules/order/model/placed_order.dart';

/// Corpo de `POST /me/orders` (`PlaceOrderBody` em
/// `apps/backend/src/modules/orders/order-http.ts`). Os textos vão como
/// digitados, inclusive vazios: quem apara, troca o vazio pelo padrão e valida
/// é o servidor.
Map<String, Object?> encodePlaceOrder(
  String recipientName,
  String deliveryInstructions,
) => {
  'recipientName': recipientName,
  'deliveryInstructions': deliveryInstructions,
};

/// Converte o `201` de `POST /me/orders` (`OrderDetailDTO`, de
/// `modules/orders/src/order/dto/order.dto.ts`) num [PlacedOrder]. Só lê o
/// `id`, que precisa ser texto não vazio; o resto do pedido é ignorado (a
/// leitura completa é da etapa 13). Fora disso lança `FormatException`, e o
/// `runRequest` converte em falha inesperada.
PlacedOrder parsePlacedOrder(Object? data) {
  if (data is! Map<String, Object?>) {
    throw const FormatException('pedido fora do formato');
  }
  final id = data['id'];
  if (id is String && id.isNotEmpty) return PlacedOrder(id);
  throw FormatException('id ausente ou fora do formato ($id)');
}
