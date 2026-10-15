import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_progress.dart';
import 'package:mobile/modules/order/model/order_status.dart';

/// Situação de cada passo, na ordem, para um pedido em [status].
List<OrderStepState> _statesOf(OrderStatus status) => [
  for (final step in OrderStatus.values) orderStepState(status, step),
];

void main() {
  const done = OrderStepState.done;
  const current = OrderStepState.current;
  const pending = OrderStepState.pending;

  group('orderStepState', () {
    test('PLACED: 1 concluído, 1 atual e 3 pendentes', () {
      expect(_statesOf(OrderStatus.placed), [
        done,
        current,
        pending,
        pending,
        pending,
      ]);
    });

    test('PAYMENT_APPROVED: 2 concluídos, 1 atual e 2 pendentes', () {
      expect(_statesOf(OrderStatus.paymentApproved), [
        done,
        done,
        current,
        pending,
        pending,
      ]);
    });

    test('OUT_FOR_DELIVERY: a entrega é o passo atual', () {
      expect(_statesOf(OrderStatus.outForDelivery), [
        done,
        done,
        done,
        done,
        current,
      ]);
    });

    test('DELIVERED: 5 concluídos e nenhum atual', () {
      expect(_statesOf(OrderStatus.delivered), List.filled(5, done));
    });
  });

  group('isOrderFinished', () {
    test('só o pedido entregue é final', () {
      expect(isOrderFinished(OrderStatus.delivered), isTrue);
      for (final status in OrderStatus.values.take(4)) {
        expect(isOrderFinished(status), isFalse, reason: status.name);
      }
    });
  });
}
