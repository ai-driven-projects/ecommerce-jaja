import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_description.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../shared/support/themed.dart';

Widget _description(String text) =>
    themed(SingleChildScrollView(child: ProductDescription(description: text)));

Text _body(WidgetTester tester, String text) =>
    tester.widget<Text>(find.text(text));

void main() {
  test('a descrição de exemplo tem 700 caracteres', () {
    expect(tonerDescription.length, 700);
  });

  testWidgets('"Sobre o produto" como título', (tester) async {
    await tester.pumpWidget(_description('Curta.'));

    expect(find.text(ProductDescription.title), findsOneWidget);
    expect(find.text('Curta.'), findsOneWidget);
  });

  testWidgets('700 caracteres: recolhida em 8 linhas com "Ler mais"', (
    tester,
  ) async {
    await tester.pumpWidget(_description(tonerDescription));

    final body = _body(tester, tonerDescription);
    expect(body.maxLines, ProductDescription.collapsedLines);
    expect(body.maxLines, 8);
    expect(body.overflow, TextOverflow.ellipsis);
    expect(find.text('Ler mais'), findsOneWidget);
    expect(find.text('Ler menos'), findsNothing);
  });

  testWidgets('tocar em "Ler mais" mostra o texto inteiro e "Ler menos"', (
    tester,
  ) async {
    await tester.pumpWidget(_description(tonerDescription));

    await tester.tap(find.text('Ler mais'));
    await tester.pump();

    expect(_body(tester, tonerDescription).maxLines, isNull);
    expect(find.text('Ler menos'), findsOneWidget);
    expect(find.text('Ler mais'), findsNothing);

    await tester.tap(find.text('Ler menos'));
    await tester.pump();

    expect(_body(tester, tonerDescription).maxLines, 8);
    expect(find.text('Ler mais'), findsOneWidget);
  });

  testWidgets('600 caracteres: inteira, sem botão', (tester) async {
    final text = 'a' * 600;
    await tester.pumpWidget(_description(text));

    expect(_body(tester, text).maxLines, isNull);
    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets('quebras de linha preservadas', (tester) async {
    const text = 'Primeira linha.\nSegunda linha.\n\nTerceira.';
    await tester.pumpWidget(_description(text));

    expect(find.text(text), findsOneWidget);
    expect(tonerDescription, contains('\n'));
    await tester.pumpWidget(_description(tonerDescription));
    expect(find.text(tonerDescription), findsOneWidget);
  });
}
