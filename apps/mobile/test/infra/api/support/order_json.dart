// JSON do `201` de `POST /me/orders` (`OrderDetailDTO` em
// `modules/orders/src/order/dto/order.dto.ts`): um pedido recém-criado com
// duas linhas, entregue no cadastro de Fortaleza. O fechamento só lê o `id`;
// o `200` de `GET /me/orders/:id` traz o mesmo pedido ([orderDetailJson]).

const placedOrderId = '3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f';

const placedOrderJson = <String, Object?>{
  'id': placedOrderId,
  'customerId': '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01',
  'status': 'PLACED',
  'items': [
    {
      'productId': '0c6a3e1f-2b4d-4e8a-9f10-1a2b3c4d5e01',
      'name': 'Banana prata',
      'unit': 'kg',
      'thumbUrl': null,
      'unitPriceCents': 699,
      'quantity': 2,
      'lineTotalCents': 1398,
    },
    {
      'productId': '0c6a3e1f-2b4d-4e8a-9f10-1a2b3c4d5e02',
      'name': 'Leite integral 1 L',
      'unit': 'un',
      'thumbUrl': null,
      'unitPriceCents': 549,
      'quantity': 1,
      'lineTotalCents': 549,
    },
  ],
  'deliveryAddress': {
    'zipCode': '60150160',
    'street': 'Avenida Santos Dumont',
    'number': '1500',
    'complement': 'Sala 3',
    'neighborhood': 'Aldeota',
    'city': 'Fortaleza',
    'state': 'CE',
  },
  'recipientName': 'Maria Souza',
  'deliveryInstructions': null,
  'itemCount': 3,
  'subtotalCents': 1947,
  'deliveryFeeCents': 799,
  'totalCents': 2746,
  'placedAt': '2026-10-15T12:00:00.000Z',
  'paymentApprovedAt': null,
  'pickingStartedAt': null,
  'outForDeliveryAt': null,
  'deliveredAt': null,
};

/// `200` de `GET /me/orders/:id`: o mesmo pedido do [placedOrderJson],
/// `PLACED`, sem instruções e com os passos seguintes ainda sem data.
const orderDetailJson = placedOrderJson;

/// Pedido com o pagamento aprovado às 12:01:30 UTC; separação e entrega
/// ainda sem data.
final orderPaymentApprovedJson = <String, Object?>{
  ...orderDetailJson,
  'status': 'PAYMENT_APPROVED',
  'paymentApprovedAt': '2026-10-15T12:01:30.000Z',
};

/// Pedido entregue, com a data de cada passo preenchida.
final orderDeliveredJson = <String, Object?>{
  ...orderDetailJson,
  'status': 'DELIVERED',
  'paymentApprovedAt': '2026-10-15T12:01:30.000Z',
  'pickingStartedAt': '2026-10-15T12:05:00.000Z',
  'outForDeliveryAt': '2026-10-15T12:20:00.000Z',
  'deliveredAt': '2026-10-15T12:41:07.000Z',
};

/// Pedido com entrega grátis: total igual ao subtotal.
final orderFreeDeliveryJson = <String, Object?>{
  ...orderDetailJson,
  'deliveryFeeCents': 0,
  'totalCents': 1947,
};

/// Pedido com instruções de entrega.
final orderWithInstructionsJson = <String, Object?>{
  ...orderDetailJson,
  'deliveryInstructions': 'Portão azul, tocar o interfone.',
};

/// Pedido válido sem o [field].
Map<String, Object?> placedOrderWithout(String field) =>
    Map.of(placedOrderJson)..remove(field);

/// Pedido válido com o [field] trocado por [value].
Map<String, Object?> placedOrderWith(String field, Object? value) => {
  ...placedOrderJson,
  field: value,
};

// Recusas de `POST /me/orders` (`throwOrderFailure` em
// `apps/backend/src/modules/orders/order-http.ts`): `ApiErrorResponse` com os
// códigos em `message`, sem repetição. `ORDER_NOT_FOUND` vem com `404`,
// `ORDER_ALREADY_EXISTS` com `409` e o resto com `400`.

/// Corpo de uma recusa com o [statusCode] e os [codes].
Map<String, Object?> orderRejectionJson(int statusCode, List<String> codes) => {
  'statusCode': statusCode,
  'error': switch (statusCode) {
    401 => 'Unauthorized',
    404 => 'Not Found',
    409 => 'Conflict',
    _ => 'Bad Request',
  },
  'message': codes,
};

final customerRequiredJson = orderRejectionJson(400, [
  'ORDER_CUSTOMER_REQUIRED',
]);

final customerInactiveJson = orderRejectionJson(400, [
  'ORDER_CUSTOMER_INACTIVE',
]);

final cartHasUnavailableItemsJson = orderRejectionJson(400, [
  'ORDER_CART_HAS_UNAVAILABLE_ITEMS',
]);

/// `404` de `GET /me/orders/:id`: pedido ausente, apagado, de outra conta ou
/// com id malformado.
final orderNotFoundJson = orderRejectionJson(404, ['ORDER_NOT_FOUND']);

final textTooShortJson = orderRejectionJson(400, ['TEXT_TOO_SHORT']);

/// Recusa com um código que o app não conhece.
final unknownOrderRejectionJson = orderRejectionJson(400, ['ALGO_NOVO']);
