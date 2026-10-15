import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_status.dart';

import '../support/fake_order_repository.dart';
import '../support/order_fixtures.dart';

void main() {
  group('OrderDetail', () {
    test('number usa os 8 primeiros caracteres do id', () {
      expect(fakeOrderDetail(id: fakePlacedOrderId).number, '3F1C9A52');
    });

    test('dateOf devolve a data de cada passo', () {
      final approved = DateTime.utc(2026, 10, 15, 12, 1);
      final picking = DateTime.utc(2026, 10, 15, 12, 2);
      final outForDelivery = DateTime.utc(2026, 10, 15, 12, 3);
      final delivered = DateTime.utc(2026, 10, 15, 12, 4);
      final order = fakeOrderDetail(
        id: fakePlacedOrderId,
        status: OrderStatus.delivered,
        paymentApprovedAt: approved,
        pickingStartedAt: picking,
        outForDeliveryAt: outForDelivery,
        deliveredAt: delivered,
      );

      expect(order.dateOf(OrderStatus.placed), fakeOrderPlacedAt);
      expect(order.dateOf(OrderStatus.paymentApproved), approved);
      expect(order.dateOf(OrderStatus.picking), picking);
      expect(order.dateOf(OrderStatus.outForDelivery), outForDelivery);
      expect(order.dateOf(OrderStatus.delivered), delivered);
    });

    test('dateOf de um passo não alcançado é null', () {
      final order = fakeOrderDetail(id: fakePlacedOrderId);

      for (final step in OrderStatus.values.skip(1)) {
        expect(order.dateOf(step), isNull, reason: step.name);
      }
    });
  });
}
