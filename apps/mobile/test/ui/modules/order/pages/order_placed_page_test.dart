import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/order/pages/order_placed_page.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';

import '../../../../modules/order/support/fake_order_repository.dart';

void main() {
  testWidgets('mostra o número, o texto e "Voltar para a loja" abre o Início', (
    tester,
  ) async {
    var stores = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: OrderPlacedPage(
          orderId: fakePlacedOrderId,
          onBackToStore: () => stores++,
        ),
      ),
    );

    expect(find.text('Pedido #3F1C9A52 recebido'), findsOneWidget);
    expect(find.text(OrderPlacedPage.message), findsOneWidget);

    await tester.tap(find.text(OrderPlacedPage.backToStoreAction));

    expect(stores, 1);
  });
}
