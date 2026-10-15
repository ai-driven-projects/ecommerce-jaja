import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/ui/modules/order/view_models/order_formatters.dart';

import '../../../../modules/order/support/order_fixtures.dart';

void main() {
  group('formatOrderTime e formatOrderTimeWithSeconds', () {
    test('completam com zeros à esquerda', () {
      final date = DateTime(2026, 10, 15, 9, 3, 7);

      expect(formatOrderTime(date), '09:03');
      expect(formatOrderTimeWithSeconds(date), '09:03:07');
    });

    test('mantêm horas de dois dígitos', () {
      final date = DateTime(2026, 10, 15, 18, 30, 45);

      expect(formatOrderTime(date), '18:30');
      expect(formatOrderTimeWithSeconds(date), '18:30:45');
    });
  });

  group('formatOrderPlacedAt', () {
    test('pedido do mesmo dia: "Feito hoje às HH:MM"', () {
      expect(
        formatOrderPlacedAt(
          DateTime(2026, 10, 15, 9, 3),
          DateTime(2026, 10, 15, 23, 59),
        ),
        'Feito hoje às 09:03',
      );
    });

    test('pedido de outro dia: "Feito em DD/MM/AAAA às HH:MM"', () {
      expect(
        formatOrderPlacedAt(
          DateTime(2026, 10, 14, 18, 30),
          DateTime(2026, 10, 15, 0, 5),
        ),
        'Feito em 14/10/2026 às 18:30',
      );
    });

    test('mesmo dia de outro mês ou ano não é hoje', () {
      expect(
        formatOrderPlacedAt(DateTime(2026, 9, 5, 7), DateTime(2026, 10, 5)),
        'Feito em 05/09/2026 às 07:00',
      );
      expect(
        formatOrderPlacedAt(DateTime(2025, 10, 15, 7), DateTime(2026, 10, 15)),
        'Feito em 15/10/2025 às 07:00',
      );
    });
  });

  group('formatOrderAddress', () {
    test('com complemento', () {
      expect(
        formatOrderAddress(fakeOrderAddress),
        'Avenida Santos Dumont, 1500 · Sala 3 · Aldeota · Fortaleza/CE',
      );
    });

    test('sem complemento', () {
      expect(
        formatOrderAddress(fakeOrderAddress.copyWith(complement: null)),
        'Avenida Santos Dumont, 1500 · Aldeota · Fortaleza/CE',
      );
    });

    test('complemento em branco é omitido; o preenchido sai aparado', () {
      expect(
        formatOrderAddress(fakeOrderAddress.copyWith(complement: '   ')),
        'Avenida Santos Dumont, 1500 · Aldeota · Fortaleza/CE',
      );
      expect(
        formatOrderAddress(fakeOrderAddress.copyWith(complement: ' Sala 3 ')),
        'Avenida Santos Dumont, 1500 · Sala 3 · Aldeota · Fortaleza/CE',
      );
    });
  });

  test('orderStatusLabel tem os cinco rótulos do web', () {
    expect(
      {
        for (final status in OrderStatus.values)
          status: orderStatusLabel(status),
      },
      {
        OrderStatus.placed: 'Pedido recebido',
        OrderStatus.paymentApproved: 'Pagamento aprovado',
        OrderStatus.picking: 'Separando na loja',
        OrderStatus.outForDelivery: 'A caminho',
        OrderStatus.delivered: 'Entregue',
      },
    );
  });
}
