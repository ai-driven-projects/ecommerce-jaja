import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/order_dto.dart';
import 'package:mobile/modules/order/model/placed_order.dart';

import 'support/order_json.dart';

Matcher throwsFormatExceptionNaming(String field) => throwsA(
  isA<FormatException>().having(
    (error) => error.message,
    'message',
    contains(field),
  ),
);

void main() {
  group('parsePlacedOrder', () {
    test('lê o id do 201 e ignora o resto do pedido', () {
      final decoded = jsonDecode(jsonEncode(placedOrderJson));

      final order = parsePlacedOrder(decoded);

      expect(order, const PlacedOrder(placedOrderId));
      expect(order.number, '3F1C9A52');
    });

    test('sem id lança erro de parsing', () {
      expect(
        () => parsePlacedOrder(placedOrderWithout('id')),
        throwsFormatExceptionNaming('id'),
      );
    });

    test('id vazio lança erro de parsing', () {
      expect(
        () => parsePlacedOrder(placedOrderWith('id', '')),
        throwsFormatExceptionNaming('id'),
      );
    });

    test('id de outro tipo lança erro de parsing', () {
      expect(
        () => parsePlacedOrder(placedOrderWith('id', 42)),
        throwsFormatExceptionNaming('id'),
      );
    });

    test('corpo que não é objeto lança erro de parsing', () {
      expect(() => parsePlacedOrder([placedOrderJson]), throwsFormatException);
      expect(() => parsePlacedOrder(null), throwsFormatException);
    });
  });

  group('encodePlaceOrder', () {
    test('leva os dois campos como digitados, sem aparar', () {
      expect(encodePlaceOrder('  Maria Souza ', 'Portão azul '), {
        'recipientName': '  Maria Souza ',
        'deliveryInstructions': 'Portão azul ',
      });
    });

    test('leva os dois campos mesmo vazios', () {
      expect(encodePlaceOrder('', ''), {
        'recipientName': '',
        'deliveryInstructions': '',
      });
    });
  });
}
