import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

void main() {
  final theme = AppTheme.light();

  test('o tema é claro, Material 3 e traz os BrandTokens', () {
    expect(theme.useMaterial3, isTrue);
    expect(theme.brightness, Brightness.light);
    expect(theme.extension<BrandTokens>(), isNotNull);
  });

  test('a primária é #FF6B00 com texto branco sobre ela', () {
    expect(theme.colorScheme.primary.toARGB32(), 0xFFFF6B00);
    expect(theme.colorScheme.onPrimary.toARGB32(), 0xFFFFFFFF);
  });

  test('o fundo das telas é o papel #FAF8F5 e o texto é tinta', () {
    expect(theme.scaffoldBackgroundColor.toARGB32(), 0xFFFAF8F5);
    expect(theme.colorScheme.onSurface.toARGB32(), 0xFF1E1812);
  });

  test(
    'a barra de abas é branca, com indicador brandSoft e aba ativa brand',
    () {
      final bar = theme.navigationBarTheme;
      const selected = {WidgetState.selected};
      const idle = <WidgetState>{};

      expect(bar.backgroundColor, BrandTokens.light.card);
      expect(bar.indicatorColor, BrandTokens.light.brandSoft);
      expect(bar.surfaceTintColor, Colors.transparent);
      expect(bar.height, 64);
      expect(bar.iconTheme!.resolve(selected)!.color, BrandTokens.light.brand);
      expect(bar.iconTheme!.resolve(idle)!.color, BrandTokens.light.mutedInk);
      expect(
        bar.labelTextStyle!.resolve(selected)!.color,
        BrandTokens.light.brand,
      );
      expect(
        bar.labelTextStyle!.resolve(idle)!.color,
        BrandTokens.light.mutedInk,
      );
      expect(
        bar.labelTextStyle!.resolve(idle)!.fontSize,
        theme.textTheme.labelMedium!.fontSize,
      );
    },
  );

  testWidgets('com o aparelho em modo escuro o app continua claro', (
    tester,
  ) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

    await tester.pumpWidget(const JajaApp());

    final context = tester.element(find.byType(Scaffold).first);
    final current = Theme.of(context);
    expect(MediaQuery.platformBrightnessOf(context), Brightness.dark);
    expect(current.brightness, Brightness.light);
    expect(current.scaffoldBackgroundColor.toARGB32(), 0xFFFAF8F5);
    expect(current.colorScheme.onSurface.toARGB32(), 0xFF1E1812);

    final material = tester.widget<Material>(
      find
          .descendant(
            of: find.byType(Scaffold).first,
            matching: find.byType(Material),
          )
          .first,
    );
    expect(material.color?.toARGB32(), 0xFFFAF8F5);
  });
}
