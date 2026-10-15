import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/placed_order.dart';

void main() {
  group('PlacedOrder.number', () {
    test('usa os 8 primeiros caracteres do id em maiúsculas', () {
      const order = PlacedOrder('3f1c9a52-7b1e-4c2d-9a8b-0e1f2a3b4c5d');

      expect(order.number, '3F1C9A52');
    });

    test('id curto vira o id inteiro em maiúsculas', () {
      expect(const PlacedOrder('ab').number, 'AB');
    });
  });
}
