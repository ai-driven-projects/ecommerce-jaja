import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/theme/app_typography.dart';
import 'package:mobile/ui/shared/widgets/product_art.dart';

import '../support/themed.dart';

Widget _art(ProductArtSize size, double side) => themed(
  Center(
    child: SizedBox(
      width: side,
      height: side,
      child: ProductArt(emoji: '🖨️', tint: ProductArtTint.blue, size: size),
    ),
  ),
);

TextStyle? _emojiStyle(WidgetTester tester) =>
    tester.widget<Text>(find.text('🖨️')).style;

TextTheme _textTheme(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(ProductArt))).textTheme;

void main() {
  testWidgets('gallery preenche o pai e usa o emoji grande', (tester) async {
    await tester.pumpWidget(_art(ProductArtSize.gallery, 300));

    expect(tester.getSize(find.byType(ProductArt)), const Size(300, 300));
    expect(_emojiStyle(tester), _textTheme(tester).artEmojiLarge);
  });

  testWidgets('thumb preenche o pai e usa o emoji da miniatura', (
    tester,
  ) async {
    await tester.pumpWidget(_art(ProductArtSize.thumb, 64));

    expect(tester.getSize(find.byType(ProductArt)), const Size(64, 64));
    expect(_emojiStyle(tester), _textTheme(tester).artEmojiThumb);
  });

  testWidgets('card continua com altura 120 e o emoji do card', (tester) async {
    await tester.pumpWidget(
      themed(
        const Center(
          child: SizedBox(
            width: 180,
            child: ProductArt(emoji: '🖨️', tint: ProductArtTint.blue),
          ),
        ),
      ),
    );

    expect(
      tester.getSize(find.byType(ProductArt)),
      const Size(180, ProductArt.height),
    );
    expect(ProductArt.height, 120);
    expect(_emojiStyle(tester), _textTheme(tester).artEmoji);
  });
}
