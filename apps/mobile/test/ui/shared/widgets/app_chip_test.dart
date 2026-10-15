import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/app_chip.dart';

import '../support/themed.dart';

ShapeDecoration _decorationOf(WidgetTester tester) =>
    tester
            .widget<DecoratedBox>(
              find.descendant(
                of: find.byType(AppChip),
                matching: find.byType(DecoratedBox),
              ),
            )
            .decoration
        as ShapeDecoration;

int _borderOf(ShapeDecoration decoration) =>
    (decoration.shape as StadiumBorder).side.color.toARGB32();

int _textColor(WidgetTester tester, String text) =>
    tester.widget<Text>(find.text(text)).style!.color!.toARGB32();

void main() {
  testWidgets('ativo: fundo #FFF1E6, borda e texto #FF6B00', (tester) async {
    await tester.pumpWidget(
      themed(
        Center(
          child: AppChip(
            label: 'Coffee Break',
            selected: true,
            onSelected: () {},
          ),
        ),
      ),
    );

    final decoration = _decorationOf(tester);
    expect(decoration.color!.toARGB32(), 0xFFFFF1E6);
    expect(_borderOf(decoration), 0xFFFF6B00);
    expect(_textColor(tester, 'Coffee Break'), 0xFFFF6B00);
  });

  testWidgets('inativo: branco com borda #EFE9E2 e texto tinta', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(
        Center(
          child: AppChip(label: 'Bebidas', selected: false, onSelected: () {}),
        ),
      ),
    );

    final decoration = _decorationOf(tester);
    expect(decoration.color!.toARGB32(), 0xFFFFFFFF);
    expect(_borderOf(decoration), 0xFFEFE9E2);
    expect(_textColor(tester, 'Bebidas'), 0xFF1E1812);
  });

  testWidgets('o toque chama onSelected', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      themed(
        Center(
          child: AppChip(
            label: 'Bebidas',
            selected: false,
            onSelected: () => taps++,
          ),
        ),
      ),
    );

    await tester.tap(find.byType(AppChip));
    expect(taps, 1);
  });

  testWidgets('a semântica anuncia o chip ativo como selecionado', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      themed(
        Center(
          child: AppChip(
            label: 'Coffee Break',
            selected: true,
            onSelected: () {},
          ),
        ),
      ),
    );

    expect(
      tester.getSemantics(find.byType(AppChip)),
      isSemantics(
        label: 'Coffee Break',
        isButton: true,
        hasSelectedState: true,
        isSelected: true,
      ),
    );
    handle.dispose();
  });

  testWidgets('emoji e contagem aparecem, também no tamanho pequeno', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(
        Center(
          child: AppChip(
            label: 'Cafés',
            emoji: '☕',
            count: 12,
            size: AppChipSize.sm,
            selected: false,
            onSelected: () {},
          ),
        ),
      ),
    );

    expect(find.text('☕'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(_textColor(tester, '12'), 0xFF8A8177);
    expect(tester.widget<Text>(find.text('Cafés')).style!.fontSize, 13);
  });
}
