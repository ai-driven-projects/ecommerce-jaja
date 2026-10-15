import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_status.dart';

void main() {
  group('OrderStatus.fromBackendCode', () {
    const expected = {
      'PLACED': OrderStatus.placed,
      'PAYMENT_APPROVED': OrderStatus.paymentApproved,
      'PICKING': OrderStatus.picking,
      'OUT_FOR_DELIVERY': OrderStatus.outForDelivery,
      'DELIVERED': OrderStatus.delivered,
    };

    test('segue a ordem de ORDER_STATUSES', () {
      expect(OrderStatus.values, expected.values.toList());
    });

    for (final MapEntry(key: code, value: status) in expected.entries) {
      test('$code vira ${status.name}', () {
        expect(OrderStatus.fromBackendCode(code), status);
        expect(status.backendCode, code);
      });
    }

    test('código desconhecido devolve null', () {
      expect(OrderStatus.fromBackendCode('CANCELED'), isNull);
      expect(OrderStatus.fromBackendCode('placed'), isNull);
    });
  });
}
