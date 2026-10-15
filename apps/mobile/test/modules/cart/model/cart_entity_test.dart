import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/value_objects/money.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';

void main() {
  group('CartDetail.empty', () {
    test('tem os totais zerados e o limite da entrega grátis', () {
      final detail = CartDetail.empty();

      expect(detail.lines, isEmpty);
      expect(detail.itemCount, 0);
      expect(detail.subtotal, Money.zero);
      expect(detail.deliveryFee, Money.zero);
      expect(detail.total, Money.zero);
      expect(detail.missingForFreeDelivery, Money.zero);
      expect(detail.freeDeliveryThreshold.cents, 7900);
      expect(detail.hasUnavailableItems, isFalse);
    });

    test('é igual por valor', () {
      expect(CartDetail.empty(), CartDetail.empty());
    });
  });
}
