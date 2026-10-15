import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/price_text.dart';

import '../support/money.dart';
import '../support/themed.dart';

TextStyle _styleOf(WidgetTester tester, String text) =>
    tester.widget<Text>(find.text(text)).style!;

void main() {
  testWidgets('em oferta, o anterior aparece riscado e o atual em laranja', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(PriceText(price: money(1290), previousPrice: money(1590))),
    );

    final previous = _styleOf(tester, r'R$ 15,90');
    expect(previous.decoration, TextDecoration.lineThrough);
    expect(previous.color!.toARGB32(), 0xFFB8AFA4);

    final current = _styleOf(tester, r'R$ 12,90');
    expect(current.color!.toARGB32(), 0xFFFF6B00);
    expect(current.fontFeatures, contains(const FontFeature.tabularFigures()));

    // O anterior vem antes do atual.
    expect(
      tester.getTopLeft(find.text(r'R$ 15,90')).dx,
      lessThan(tester.getTopLeft(find.text(r'R$ 12,90')).dx),
    );
  });

  for (final previous in [1290, 990]) {
    testWidgets('anterior de $previous (não maior que 1290) é ignorado', (
      tester,
    ) async {
      await tester.pumpWidget(
        themed(PriceText(price: money(1290), previousPrice: money(previous))),
      );

      expect(find.byType(Text), findsOneWidget);
      expect(find.text(r'R$ 12,90'), findsOneWidget);
      expect(_styleOf(tester, r'R$ 12,90').color!.toARGB32(), 0xFF1E1812);
    });
  }

  testWidgets('sem anterior, o preço sai em tinta', (tester) async {
    await tester.pumpWidget(themed(PriceText(price: money(1290))));

    expect(find.byType(Text), findsOneWidget);
    expect(_styleOf(tester, r'R$ 12,90').color!.toARGB32(), 0xFF1E1812);
  });

  testWidgets('o estilo recebido mantém algarismos tabulares', (tester) async {
    await tester.pumpWidget(
      themed(
        Builder(
          builder: (context) => PriceText(
            price: money(1290),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ),
      ),
    );

    final style = _styleOf(tester, r'R$ 12,90');
    expect(style.fontSize, 24);
    expect(style.fontFeatures, contains(const FontFeature.tabularFigures()));
  });
}
