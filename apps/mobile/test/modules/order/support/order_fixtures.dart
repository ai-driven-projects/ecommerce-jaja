import 'package:mobile/modules/order/model/order_entity.dart';
import 'package:mobile/modules/order/model/order_status.dart';

import '../../../ui/shared/support/money.dart';

// Pedido de exemplo, o mesmo do `placedOrderJson`
// (`test/infra/api/support/order_json.dart`): duas linhas sem foto, entrega
// em Fortaleza com "Sala 3", "Maria Souza", sem instruções.

/// Banana prata: 2 × R$ 6,99.
final bananaOrderItem = OrderItem(
  productId: '0c6a3e1f-2b4d-4e8a-9f10-1a2b3c4d5e01',
  name: 'Banana prata',
  unit: 'kg',
  thumbUrl: null,
  unitPrice: money(699),
  quantity: 2,
  lineTotal: money(1398),
);

/// Leite integral 1 L: 1 × R$ 5,49.
final milkOrderItem = OrderItem(
  productId: '0c6a3e1f-2b4d-4e8a-9f10-1a2b3c4d5e02',
  name: 'Leite integral 1 L',
  unit: 'un',
  thumbUrl: null,
  unitPrice: money(549),
  quantity: 1,
  lineTotal: money(549),
);

const fakeOrderAddress = OrderDeliveryAddress(
  zipCode: '60150160',
  street: 'Avenida Santos Dumont',
  number: '1500',
  complement: 'Sala 3',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'CE',
);

/// Data de criação do pedido de exemplo, em UTC.
final fakeOrderPlacedAt = DateTime.utc(2026, 10, 15, 12);

/// Pedido [id] recém-feito (`PLACED`): subtotal R$ 19,47, entrega R$ 7,99 e
/// total R$ 27,46. Os parâmetros trocam o status e as datas dos passos.
OrderDetail fakeOrderDetail({
  required String id,
  OrderStatus status = OrderStatus.placed,
  String? deliveryInstructions,
  DateTime? paymentApprovedAt,
  DateTime? pickingStartedAt,
  DateTime? outForDeliveryAt,
  DateTime? deliveredAt,
}) => OrderDetail(
  id: id,
  status: status,
  items: [bananaOrderItem, milkOrderItem],
  deliveryAddress: fakeOrderAddress,
  recipientName: 'Maria Souza',
  deliveryInstructions: deliveryInstructions,
  itemCount: 3,
  subtotal: money(1947),
  deliveryFee: money(799),
  total: money(2746),
  placedAt: fakeOrderPlacedAt,
  paymentApprovedAt: paymentApprovedAt,
  pickingStartedAt: pickingStartedAt,
  outForDeliveryAt: outForDeliveryAt,
  deliveredAt: deliveredAt,
);
