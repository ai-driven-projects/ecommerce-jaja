import '../../core/result.dart';
import '../../core/value_objects/money.dart';
import '../../modules/order/model/order_entity.dart';
import '../../modules/order/model/order_status.dart';
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
/// leitura completa é a de [parseOrderDetail]). Fora disso lança `FormatException`, e o
/// `runRequest` converte em falha inesperada.
PlacedOrder parsePlacedOrder(Object? data) {
  if (data is! Map<String, Object?>) {
    throw const FormatException('pedido fora do formato');
  }
  final id = data['id'];
  if (id is String && id.isNotEmpty) return PlacedOrder(id);
  throw FormatException('id ausente ou fora do formato ($id)');
}

/// Converte o `200` de `GET /me/orders/:id` (`OrderDetailDTO`, de
/// `modules/orders/src/order/dto/order.dto.ts`) num [OrderDetail].
///
/// Os casts são estritos: campo ausente, de outro tipo, texto obrigatório
/// vazio, centavos ou quantidades negativos, `status` desconhecido e data que
/// não é ISO 8601 lançam `FormatException` com o nome do campo, e o
/// `runRequest` converte em falha inesperada. `complement`, `thumbUrl`,
/// `deliveryInstructions` e as datas dos quatro passos seguintes podem ser
/// `null`, mas não ausentes. As datas ficam em UTC; `customerId` e campos a
/// mais são ignorados. Os itens mantêm a ordem recebida (a do carrinho).
OrderDetail parseOrderDetail(Object? data) {
  final json = _map(data, 'pedido');
  final items = _required<List<Object?>>(json, 'items');
  final address = _map(json['deliveryAddress'], 'deliveryAddress');
  final statusCode = _required<String>(json, 'status');
  final status =
      OrderStatus.fromBackendCode(statusCode) ??
      (throw FormatException('status desconhecido ($statusCode)'));
  return OrderDetail(
    id: _text(json, 'id'),
    status: status,
    items: List.unmodifiable(
      items.map((item) => _orderItem(_map(item, 'items: item'))),
    ),
    deliveryAddress: OrderDeliveryAddress(
      zipCode: _text(address, 'zipCode'),
      street: _text(address, 'street'),
      number: _text(address, 'number'),
      complement: _nullable<String>(address, 'complement'),
      neighborhood: _text(address, 'neighborhood'),
      city: _text(address, 'city'),
      state: _text(address, 'state'),
    ),
    recipientName: _text(json, 'recipientName'),
    deliveryInstructions: _nullable<String>(json, 'deliveryInstructions'),
    itemCount: _count(json, 'itemCount'),
    subtotal: _money(json, 'subtotalCents'),
    deliveryFee: _money(json, 'deliveryFeeCents'),
    total: _money(json, 'totalCents'),
    placedAt: _date(_required<String>(json, 'placedAt'), 'placedAt'),
    paymentApprovedAt: _nullableDate(json, 'paymentApprovedAt'),
    pickingStartedAt: _nullableDate(json, 'pickingStartedAt'),
    outForDeliveryAt: _nullableDate(json, 'outForDeliveryAt'),
    deliveredAt: _nullableDate(json, 'deliveredAt'),
  );
}

OrderItem _orderItem(Map<String, Object?> json) {
  return OrderItem(
    productId: _text(json, 'productId'),
    name: _text(json, 'name'),
    unit: _text(json, 'unit'),
    thumbUrl: _nullable<String>(json, 'thumbUrl'),
    unitPrice: _money(json, 'unitPriceCents'),
    quantity: _count(json, 'quantity'),
    lineTotal: _money(json, 'lineTotalCents'),
  );
}

Map<String, Object?> _map(Object? data, String field) {
  if (data is Map<String, Object?>) return data;
  throw FormatException('$field fora do formato');
}

T _required<T extends Object>(Map<String, Object?> json, String field) {
  final value = json[field];
  if (value is T) return value;
  throw FormatException('$field ausente ou fora do formato ($value)');
}

T? _nullable<T extends Object>(Map<String, Object?> json, String field) {
  if (!json.containsKey(field)) {
    throw FormatException('$field ausente');
  }
  final value = json[field];
  if (value == null || value is T) return value as T?;
  throw FormatException('$field fora do formato ($value)');
}

String _text(Map<String, Object?> json, String field) {
  final value = _required<String>(json, field);
  if (value.isNotEmpty) return value;
  throw FormatException('$field vazio');
}

int _count(Map<String, Object?> json, String field) {
  final value = _required<int>(json, field);
  if (value >= 0) return value;
  throw FormatException('$field negativo ($value)');
}

Money _money(Map<String, Object?> json, String field) {
  final cents = _required<int>(json, field);
  return switch (Money.fromCents(cents)) {
    Ok(:final value) => value,
    Failure(:final failure) => throw FormatException(
      '$field fora do formato ($cents): ${failure.message}',
    ),
  };
}

DateTime? _nullableDate(Map<String, Object?> json, String field) {
  final value = _nullable<String>(json, field);
  return value == null ? null : _date(value, field);
}

DateTime _date(String value, String field) {
  try {
    return DateTime.parse(value).toUtc();
  } on FormatException {
    throw FormatException('$field fora do formato ($value)');
  }
}
