import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/order_dto.dart';
import 'package:mobile/modules/order/model/order_entity.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/modules/order/model/placed_order.dart';

import '../../modules/order/support/order_fixtures.dart';
import 'support/order_json.dart';

Matcher throwsFormatExceptionNaming(String field) => throwsA(
  isA<FormatException>().having(
    (error) => error.message,
    'message',
    contains(field),
  ),
);

/// [orderDetailJson] com a primeira linha trocada por [item].
Map<String, Object?> orderWithFirstItem(Map<String, Object?> item) => {
  ...orderDetailJson,
  'items': [item, (orderDetailJson['items']! as List<Object?>)[1]],
};

final firstItemJson =
    (orderDetailJson['items']! as List<Object?>).first! as Map<String, Object?>;

final addressJson = orderDetailJson['deliveryAddress']! as Map<String, Object?>;

void main() {
  group('parseOrderDetail', () {
    OrderDetail parse(Object? json) =>
        parseOrderDetail(jsonDecode(jsonEncode(json)));

    test(
      'o exemplo vira OrderDetail com itens, endereço, Money e datas UTC',
      () {
        final order = parse(orderDetailJson);

        expect(order, fakeOrderDetail(id: placedOrderId));
        expect(order.status, OrderStatus.placed);
        expect(order.items, [bananaOrderItem, milkOrderItem]);
        expect(order.items.first.unitPrice.cents, 699);
        expect(order.items.first.lineTotal.cents, 1398);
        expect(order.deliveryAddress, fakeOrderAddress);
        expect(order.subtotal.cents, 1947);
        expect(order.deliveryFee.cents, 799);
        expect(order.total.cents, 2746);
        expect(order.placedAt, DateTime.utc(2026, 10, 15, 12));
        expect(order.placedAt.isUtc, isTrue);
        expect(order.number, '3F1C9A52');
      },
    );

    test('lê o status e a data de cada passo preenchido, em UTC', () {
      final order = parse(orderDeliveredJson);

      expect(order.status, OrderStatus.delivered);
      expect(order.paymentApprovedAt, DateTime.utc(2026, 10, 15, 12, 1, 30));
      expect(order.pickingStartedAt, DateTime.utc(2026, 10, 15, 12, 5));
      expect(order.outForDeliveryAt, DateTime.utc(2026, 10, 15, 12, 20));
      expect(order.deliveredAt, DateTime.utc(2026, 10, 15, 12, 41, 7));
      expect(order.deliveredAt!.isUtc, isTrue);
    });

    test('passos ainda não alcançados ficam sem data', () {
      final order = parse(orderPaymentApprovedJson);

      expect(order.status, OrderStatus.paymentApproved);
      expect(order.paymentApprovedAt, DateTime.utc(2026, 10, 15, 12, 1, 30));
      expect(order.pickingStartedAt, isNull);
      expect(order.outForDeliveryAt, isNull);
      expect(order.deliveredAt, isNull);
    });

    test('frete 0 vira Money zero', () {
      final order = parse(orderFreeDeliveryJson);

      expect(order.deliveryFee.cents, 0);
      expect(order.total.cents, 1947);
    });

    test('lê as instruções quando existem', () {
      expect(
        parse(orderWithInstructionsJson).deliveryInstructions,
        'Portão azul, tocar o interfone.',
      );
    });

    test('complemento, foto e instruções aceitam null', () {
      final order = parse({
        ...orderWithFirstItem({...firstItemJson, 'thumbUrl': null}),
        'deliveryAddress': {...addressJson, 'complement': null},
        'deliveryInstructions': null,
      });

      expect(order.deliveryAddress.complement, isNull);
      expect(order.items.first.thumbUrl, isNull);
      expect(order.deliveryInstructions, isNull);
    });

    test('lê a foto da linha quando existe', () {
      final order = parse(
        orderWithFirstItem({
          ...firstItemJson,
          'thumbUrl': 'https://cdn.jaja.test/banana.webp',
        }),
      );

      expect(order.items.first.thumbUrl, 'https://cdn.jaja.test/banana.webp');
    });

    test('status desconhecido lança erro de parsing', () {
      expect(
        () => parse(placedOrderWith('status', 'CANCELLED')),
        throwsFormatExceptionNaming('status'),
      );
    });

    test('campo obrigatório ausente lança erro de parsing', () {
      for (final field in [
        'id',
        'status',
        'items',
        'deliveryAddress',
        'recipientName',
        'itemCount',
        'subtotalCents',
        'deliveryFeeCents',
        'totalCents',
        'placedAt',
      ]) {
        expect(
          () => parse(placedOrderWithout(field)),
          throwsFormatException,
          reason: field,
        );
      }
    });

    test('campo anulável ausente lança erro de parsing', () {
      expect(
        () => parse(placedOrderWithout('deliveryInstructions')),
        throwsFormatExceptionNaming('deliveryInstructions'),
      );
      expect(
        () => parse(placedOrderWithout('deliveredAt')),
        throwsFormatExceptionNaming('deliveredAt'),
      );
      expect(
        () => parse(
          placedOrderWith(
            'deliveryAddress',
            Map.of(addressJson)..remove('complement'),
          ),
        ),
        throwsFormatExceptionNaming('complement'),
      );
    });

    test('campo obrigatório da linha ou do endereço ausente lança erro de '
        'parsing', () {
      expect(
        () => parse(orderWithFirstItem(Map.of(firstItemJson)..remove('name'))),
        throwsFormatExceptionNaming('name'),
      );
      expect(
        () => parse(
          placedOrderWith(
            'deliveryAddress',
            Map.of(addressJson)..remove('street'),
          ),
        ),
        throwsFormatExceptionNaming('street'),
      );
    });

    test('texto obrigatório vazio lança erro de parsing', () {
      expect(
        () => parse(placedOrderWith('recipientName', '')),
        throwsFormatExceptionNaming('recipientName'),
      );
    });

    test('centavos negativos lançam erro de parsing', () {
      expect(
        () => parse(placedOrderWith('totalCents', -1)),
        throwsFormatExceptionNaming('totalCents'),
      );
      expect(
        () => parse(
          orderWithFirstItem({...firstItemJson, 'unitPriceCents': -699}),
        ),
        throwsFormatExceptionNaming('unitPriceCents'),
      );
    });

    test('quantidade negativa lança erro de parsing', () {
      expect(
        () => parse(orderWithFirstItem({...firstItemJson, 'quantity': -2})),
        throwsFormatExceptionNaming('quantity'),
      );
    });

    test('data inválida lança erro de parsing', () {
      expect(
        () => parse(placedOrderWith('placedAt', 'ontem')),
        throwsFormatExceptionNaming('placedAt'),
      );
      expect(
        () => parse(placedOrderWith('paymentApprovedAt', '15/10/2026')),
        throwsFormatExceptionNaming('paymentApprovedAt'),
      );
    });

    test('item que não é objeto lança erro de parsing', () {
      expect(
        () => parse(placedOrderWith('items', ['banana'])),
        throwsFormatExceptionNaming('items'),
      );
    });

    test('corpo que não é objeto lança erro de parsing', () {
      expect(() => parseOrderDetail([orderDetailJson]), throwsFormatException);
      expect(() => parseOrderDetail(null), throwsFormatException);
    });
  });

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
