import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/ui/modules/cart/widgets/cart_summary.dart';

import '../../../../modules/cart/support/cart_fixtures.dart';
import '../../../shared/support/money.dart';
import '../../../shared/support/themed.dart';

Widget _summary(CartDetail detail, {bool isSyncing = false}) =>
    themed(CartSummary(detail: detail, isSyncing: isSyncing));

void main() {
  testWidgets('entrega cobrada: subtotal, taxa, quanto falta e total', (
    tester,
  ) async {
    await tester.pumpWidget(_summary(detailOf([canetaLine])));

    expect(find.text(CartSummary.subtotalLabel), findsOneWidget);
    expect(find.text('R\$ 25,80'), findsOneWidget);
    expect(find.text(CartSummary.deliveryLabel), findsOneWidget);
    expect(find.text('R\$ 4,90'), findsOneWidget);
    expect(
      find.text('Faltam R\$ 53,20 para a entrega grátis.'),
      findsOneWidget,
    );
    expect(find.text(CartSummary.totalLabel), findsOneWidget);
    expect(find.text('R\$ 30,70'), findsOneWidget);
    expect(find.text(CartSummary.freeDeliveryLabel), findsNothing);
  });

  testWidgets('entrega grátis: "Grátis" e sem o aviso de quanto falta', (
    tester,
  ) async {
    final line = canetaLine.copyWith(
      price: money(790),
      quantity: 10,
      lineTotal: money(7900),
    );
    final detail = detailOf([line]);
    await tester.pumpWidget(_summary(detail));

    expect(detail.subtotal.cents, 7900);
    expect(detail.deliveryFee.cents, 0);
    expect(find.text(CartSummary.freeDeliveryLabel), findsOneWidget);
    expect(find.textContaining('Faltam'), findsNothing);
    expect(find.text('R\$ 79,00'), findsNWidgets(2));
  });

  testWidgets('com linha indisponível pede para removê-la', (tester) async {
    await tester.pumpWidget(_summary(detailOf([canetaLine, unavailableLine])));

    expect(find.text(CartSummary.unavailableWarning), findsOneWidget);
  });

  testWidgets('sem linha indisponível não mostra o aviso', (tester) async {
    await tester.pumpWidget(_summary(detailOf([canetaLine])));

    expect(find.text(CartSummary.unavailableWarning), findsNothing);
  });

  testWidgets('isSyncing atenua os valores e anuncia "Atualizando"', (
    tester,
  ) async {
    await tester.pumpWidget(_summary(detailOf([canetaLine]), isSyncing: true));

    expect(
      find.bySemanticsLabel(RegExp(CartSummary.syncingLabel)),
      findsOneWidget,
    );
    final opacity = tester.widget<Opacity>(
      find.ancestor(
        of: find.text(CartSummary.subtotalLabel),
        matching: find.byType(Opacity),
      ),
    );
    expect(opacity.opacity, 0.5);
  });

  testWidgets('sem isSyncing não há "Atualizando"', (tester) async {
    await tester.pumpWidget(_summary(detailOf([canetaLine])));

    expect(
      find.bySemanticsLabel(RegExp(CartSummary.syncingLabel)),
      findsNothing,
    );
    expect(
      find.ancestor(
        of: find.text(CartSummary.subtotalLabel),
        matching: find.byType(Opacity),
      ),
      findsNothing,
    );
  });

  group('checkout', () {
    testWidgets('"Entrega de bike", sem quanto falta e com o total', (
      tester,
    ) async {
      await tester.pumpWidget(
        themed(
          CartSummary.checkout(
            detail: detailOf([canetaLine]),
            isSyncing: false,
          ),
        ),
      );

      expect(find.text(CartSummary.checkoutDeliveryLabel), findsOneWidget);
      expect(find.text(CartSummary.deliveryLabel), findsNothing);
      expect(find.text('R\$ 4,90'), findsOneWidget);
      expect(find.textContaining('Faltam'), findsNothing);
      expect(find.text('R\$ 30,70'), findsOneWidget);
    });

    testWidgets('com linha indisponível não mostra o aviso da aba', (
      tester,
    ) async {
      await tester.pumpWidget(
        themed(
          CartSummary.checkout(
            detail: detailOf([canetaLine, unavailableLine]),
            isSyncing: false,
          ),
        ),
      );

      expect(find.text(CartSummary.unavailableWarning), findsNothing);
    });

    testWidgets('isSyncing também anuncia "Atualizando"', (tester) async {
      await tester.pumpWidget(
        themed(
          CartSummary.checkout(detail: detailOf([canetaLine]), isSyncing: true),
        ),
      );

      expect(
        find.bySemanticsLabel(RegExp(CartSummary.syncingLabel)),
        findsOneWidget,
      );
    });
  });
}
