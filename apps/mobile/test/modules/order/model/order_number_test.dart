import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_number.dart';
import 'package:mobile/modules/order/model/placed_order.dart';

void main() {
  group('orderNumberOf', () {
    test('usa os 8 primeiros caracteres do id em maiúsculas', () {
      expect(orderNumberOf('3f1c9a52-7b1e-4c2d-9e8f-0a1b2c3d4e5f'), '3F1C9A52');
    });

    test('id curto vira o id inteiro em maiúsculas', () {
      expect(orderNumberOf('ab'), 'AB');
    });

    test('é o número do PlacedOrder', () {
      expect(const PlacedOrder('3f1c9a52-7b1e').number, '3F1C9A52');
    });
  });
}
