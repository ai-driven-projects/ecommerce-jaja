import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/store/widgets/store_pill.dart';

import '../../../../modules/store/support/store_fixtures.dart';
import '../../../shared/support/themed.dart';

int _textColor(WidgetTester tester, String text) =>
    tester.widget<Text>(find.text(text)).style!.color!.toARGB32();

void main() {
  testWidgets('mostra o nome em laranja e a cidade/UF em cinza', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(
        Center(
          child: StorePill(store: paulista, onTap: () {}),
        ),
      ),
    );

    expect(find.text('Loja Paulista'), findsOneWidget);
    expect(find.text('São Paulo/SP'), findsOneWidget);
    expect(find.byIcon(Icons.storefront_outlined), findsOneWidget);
    expect(_textColor(tester, 'Loja Paulista'), 0xFFFF6B00);
    expect(_textColor(tester, 'São Paulo/SP'), 0xFF8A8177);
  });

  testWidgets('sem cidade/UF no endereço, só o nome', (tester) async {
    final store = paulista.copyWith(address: 'Rua X, 10');
    await tester.pumpWidget(
      themed(
        Center(
          child: StorePill(store: store, onTap: () {}),
        ),
      ),
    );

    expect(find.text('Loja Paulista'), findsOneWidget);
    expect(find.text('São Paulo/SP'), findsNothing);
    expect(find.text(' · '), findsNothing);
  });

  testWidgets('tocável: chevron, botão na semântica e o toque chama onTap', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    var taps = 0;
    await tester.pumpWidget(
      themed(
        Center(
          child: StorePill(store: paulista, onTap: () => taps++),
        ),
      ),
    );

    expect(find.byIcon(Icons.expand_more), findsOneWidget);
    expect(
      tester.getSemantics(find.byType(StorePill)),
      isSemantics(
        label: 'Loja escolhida: Loja Paulista. Trocar de loja',
        isButton: true,
      ),
    );

    await tester.tap(find.byType(StorePill));
    expect(taps, 1);
    handle.dispose();
  });

  testWidgets('estática: sem chevron e sem responder ao toque', (tester) async {
    await tester.pumpWidget(
      themed(const Center(child: StorePill(store: paulista))),
    );

    expect(find.text('Loja Paulista'), findsOneWidget);
    expect(find.byIcon(Icons.expand_more), findsNothing);
    expect(
      find.descendant(
        of: find.byType(StorePill),
        matching: find.byType(GestureDetector),
      ),
      findsNothing,
    );
  });

  testWidgets('a pílula tem a altura fixa, com ou sem cidade', (tester) async {
    await tester.pumpWidget(
      themed(
        Column(
          children: [
            StorePill(store: paulista, onTap: () {}),
            StorePill(store: paulista.copyWith(address: null)),
          ],
        ),
      ),
    );

    final pills = find.byType(StorePill);
    expect(pills, findsNWidgets(2));
    for (final element in pills.evaluate()) {
      expect(element.size!.height, StorePill.height);
    }
  });
}
