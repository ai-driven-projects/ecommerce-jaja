import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/model/order_status.dart';
import 'package:mobile/ui/modules/order/widgets/order_status_badge.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

import '../../../shared/support/themed.dart';

ShapeDecoration _decoration(WidgetTester tester) =>
    tester
            .widget<DecoratedBox>(
              find.descendant(
                of: find.byType(OrderStatusBadge),
                matching: find.byType(DecoratedBox),
              ),
            )
            .decoration
        as ShapeDecoration;

Future<BrandTokens> _pump(WidgetTester tester, OrderStatus status) async {
  await tester.pumpWidget(themed(OrderStatusBadge(status: status)));
  return tester.element(find.byType(OrderStatusBadge)).tokens;
}

void main() {
  const labels = {
    OrderStatus.placed: 'Pedido recebido',
    OrderStatus.paymentApproved: 'Pagamento aprovado',
    OrderStatus.picking: 'Separando na loja',
    OrderStatus.outForDelivery: 'A caminho',
    OrderStatus.delivered: 'Entregue',
  };

  for (final MapEntry(key: status, value: label) in labels.entries) {
    testWidgets('${status.backendCode} mostra "$label"', (tester) async {
      await _pump(tester, status);

      expect(find.text(label), findsOneWidget);
    });
  }

  for (final status in [
    OrderStatus.placed,
    OrderStatus.paymentApproved,
    OrderStatus.outForDelivery,
  ]) {
    testWidgets('${status.backendCode}: verde (successSoft/success)', (
      tester,
    ) async {
      final tokens = await _pump(tester, status);

      expect(_decoration(tester).color, tokens.successSoft);
      expect(
        tester.widget<Text>(find.text(labels[status]!)).style!.color,
        tokens.success,
      );
    });
  }

  testWidgets('PICKING: amarelo (warningSoft/warning)', (tester) async {
    final tokens = await _pump(tester, OrderStatus.picking);

    expect(_decoration(tester).color, tokens.warningSoft);
    expect(
      tester.widget<Text>(find.text('Separando na loja')).style!.color,
      tokens.warning,
    );
  });

  testWidgets('DELIVERED: neutro (surface/mutedInk)', (tester) async {
    final tokens = await _pump(tester, OrderStatus.delivered);

    expect(_decoration(tester).color, tokens.surface);
    expect(
      tester.widget<Text>(find.text('Entregue')).style!.color,
      tokens.mutedInk,
    );
  });
}
