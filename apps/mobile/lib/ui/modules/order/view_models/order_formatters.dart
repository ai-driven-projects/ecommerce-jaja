import '../../../../modules/order/model/order_entity.dart';
import '../../../../modules/order/model/order_status.dart';

// Textos do pedido na tela, de `apps/frontend/src/modules/orders/data/`
// (`order.util.ts` e `ORDER_STATUS_LABEL` de `order-status.util.ts`). As
// datas chegam **já no fuso do aparelho**: quem chama faz o `.toLocal()`, e os
// testes não dependem do fuso da máquina.

String _pad(int value) => value.toString().padLeft(2, '0');

/// Hora `HH:MM` de [date].
String formatOrderTime(DateTime date) =>
    '${_pad(date.hour)}:${_pad(date.minute)}';

/// Hora `HH:MM:SS` de [date], para os passos do pedido: o ciclo simulado leva
/// segundos, e só com eles dá para ver a demora de cada serviço.
String formatOrderTimeWithSeconds(DateTime date) =>
    '${formatOrderTime(date)}:${_pad(date.second)}';

/// "Feito hoje às HH:MM" quando [placedAt] é do mesmo dia de [now], senão
/// "Feito em DD/MM/AAAA às HH:MM".
String formatOrderPlacedAt(DateTime placedAt, DateTime now) {
  final time = formatOrderTime(placedAt);
  final isToday =
      placedAt.year == now.year &&
      placedAt.month == now.month &&
      placedAt.day == now.day;
  if (isToday) return 'Feito hoje às $time';
  return 'Feito em ${_pad(placedAt.day)}/${_pad(placedAt.month)}/'
      '${placedAt.year} às $time';
}

/// Endereço de entrega em uma linha: "Rua, número · complemento · bairro ·
/// cidade/UF", com o complemento aparado e omitido quando `null` ou vazio.
String formatOrderAddress(OrderDeliveryAddress address) {
  final complement = address.complement?.trim() ?? '';
  return [
    '${address.street}, ${address.number}',
    if (complement.isNotEmpty) complement,
    address.neighborhood,
    '${address.city}/${address.state}',
  ].join(' · ');
}

/// Nome de cada status, no selo e nos passos (`ORDER_STATUS_LABEL`).
String orderStatusLabel(OrderStatus status) => switch (status) {
  OrderStatus.placed => 'Pedido recebido',
  OrderStatus.paymentApproved => 'Pagamento aprovado',
  OrderStatus.picking => 'Separando na loja',
  OrderStatus.outForDelivery => 'A caminho',
  OrderStatus.delivered => 'Entregue',
};
