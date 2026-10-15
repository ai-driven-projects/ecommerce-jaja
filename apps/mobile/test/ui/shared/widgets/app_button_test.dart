import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';

import '../support/themed.dart';

Material _materialOf(WidgetTester tester) => tester.widget<Material>(
  find.descendant(of: find.byType(TextButton), matching: find.byType(Material)),
);

void main() {
  testWidgets('primário: fundo #FF6B00, texto branco 800 e pílula', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(
        Center(
          child: AppButton(label: 'Finalizar pedido', onPressed: () {}),
        ),
      ),
    );

    final material = _materialOf(tester);
    expect(material.color!.toARGB32(), 0xFFFF6B00);
    expect(material.shape, isA<StadiumBorder>());

    final text = tester
        .renderObject<RenderParagraph>(find.text('Finalizar pedido'))
        .text
        .style!;
    expect(text.color!.toARGB32(), 0xFFFFFFFF);
    expect(text.fontWeight, FontWeight.w800);

    // A sombra da marca envolve o primário disponível.
    final shadow = tester.widget<DecoratedBox>(
      find.ancestor(
        of: find.byType(TextButton),
        matching: find.byType(DecoratedBox),
      ),
    );
    expect((shadow.decoration as ShapeDecoration).shadows, isNotEmpty);
  });

  for (final (size, height) in [
    (AppButtonSize.sm, 36.0),
    (AppButtonSize.md, 40.0),
    (AppButtonSize.lg, 48.0),
    (AppButtonSize.xl, 52.0),
  ]) {
    testWidgets('tamanho ${size.name} tem altura $height', (tester) async {
      await tester.pumpWidget(
        themed(
          Center(
            child: AppButton(label: 'Comprar', size: size, onPressed: () {}),
          ),
        ),
      );

      expect(tester.getSize(find.byType(TextButton)).height, height);
    });
  }

  testWidgets('o toque chama a ação', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      themed(
        Center(
          child: AppButton(label: 'Comprar', onPressed: () => taps++),
        ),
      ),
    );

    await tester.tap(find.text('Comprar'));
    expect(taps, 1);
  });

  testWidgets('sem ação, o toque não faz nada e o botão fica atenuado', (
    tester,
  ) async {
    await tester.pumpWidget(
      themed(const Center(child: AppButton(label: 'Comprar', onPressed: null))),
    );

    await tester.tap(find.text('Comprar'), warnIfMissed: false);
    await tester.pump();

    expect(tester.widget<TextButton>(find.byType(TextButton)).enabled, isFalse);
    final opacity = tester.widget<Opacity>(
      find.ancestor(
        of: find.byType(TextButton),
        matching: find.byType(Opacity),
      ),
    );
    expect(opacity.opacity, 0.5);
    // Indisponível não tem a sombra da marca.
    expect(
      find.ancestor(
        of: find.byType(TextButton),
        matching: find.byType(DecoratedBox),
      ),
      findsNothing,
    );
  });

  testWidgets('ícone à esquerda e largura total', (tester) async {
    await tester.pumpWidget(
      themed(
        AppButton(
          label: 'Adicionar',
          icon: Icons.add,
          expand: true,
          onPressed: () {},
        ),
      ),
    );

    expect(
      tester.getTopLeft(find.byIcon(Icons.add)).dx,
      lessThan(tester.getTopLeft(find.text('Adicionar')).dx),
    );
    expect(tester.getSize(find.byType(TextButton)).width, 800);
  });
}
