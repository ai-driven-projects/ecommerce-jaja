import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/widgets/home_hero.dart';

import '../../../shared/support/themed.dart';

void main() {
  testWidgets('com loja, a pílula diz de onde a entrega sai', (tester) async {
    await tester.pumpWidget(themed(const HomeHero(storeName: 'Loja Paulista')));

    expect(
      find.text('De bike e a pé, saindo da Loja Paulista'),
      findsOneWidget,
    );
    expect(find.text('De bike e a pé até você'), findsNothing);
    expect(find.byIcon(Icons.pedal_bike), findsOneWidget);
  });

  testWidgets('sem loja, "De bike e a pé até você"', (tester) async {
    await tester.pumpWidget(themed(const HomeHero(storeName: null)));

    expect(find.text('De bike e a pé até você'), findsOneWidget);
    expect(find.textContaining('saindo da'), findsNothing);
  });

  testWidgets('título com "em minutos." em laranja claro e o parágrafo', (
    tester,
  ) async {
    await tester.pumpWidget(themed(const HomeHero(storeName: null)));

    final title = tester.widget<Text>(find.textContaining('em minutos.'));
    expect(
      title.textSpan!.toPlainText(),
      'Acabou no escritório?\nChega em minutos.',
    );
    expect(title.style!.color!.toARGB32(), 0xFFFFFFFF);
    final accent = (title.textSpan! as TextSpan).children!.single as TextSpan;
    expect(accent.text, 'em minutos.');
    expect(accent.style!.color!.toARGB32(), 0xFFFF8A3D);

    expect(find.textContaining('sem taxa surpresa.'), findsOneWidget);
    expect(find.textContaining('entregadores'), findsNothing);
    expect(find.text('Pedir agora'), findsNothing);
  });
}
