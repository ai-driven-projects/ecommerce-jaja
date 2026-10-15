import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/theme/app_fonts.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';

double? _wght(TextStyle style) => style.fontVariations
    ?.firstWhere((variation) => variation.axis == 'wght')
    .value;

void main() {
  final textTheme = AppTheme.light().textTheme;

  test('o tema usa Manrope como família padrão', () {
    expect(AppTheme.light().textTheme.bodyMedium!.fontFamily, AppFonts.sans);
  });

  test('o corpo é Manrope 400', () {
    for (final style in [
      textTheme.bodyLarge!,
      textTheme.bodyMedium!,
      textTheme.bodySmall!,
    ]) {
      expect(style.fontFamily, AppFonts.sans);
      expect(style.fontWeight, FontWeight.w400);
      expect(_wght(style), 400);
    }
  });

  test('os títulos são Bricolage 800 com letterSpacing negativo', () {
    final titles = {
      'displaySmall': (textTheme.displaySmall!, 30.0),
      'headlineSmall': (textTheme.headlineSmall!, 24.0),
      'titleLarge': (textTheme.titleLarge!, 20.0),
    };

    for (final MapEntry(key: role, value: (style, size)) in titles.entries) {
      expect(style.fontFamily, AppFonts.display, reason: role);
      expect(style.fontWeight, FontWeight.w800, reason: role);
      expect(_wght(style), 800, reason: role);
      expect(style.fontSize, size, reason: role);
      expect(style.letterSpacing, lessThan(0), reason: role);
    }
  });

  test(
    'botão, preço e selo são Manrope 800; preço em algarismos tabulares',
    () {
      for (final style in [
        textTheme.labelLarge!,
        textTheme.titleMedium!,
        textTheme.labelSmall!,
      ]) {
        expect(style.fontFamily, AppFonts.sans);
        expect(style.fontWeight, FontWeight.w800);
        expect(_wght(style), 800);
      }
      expect(
        textTheme.titleMedium!.fontFeatures,
        contains(const FontFeature.tabularFigures()),
      );
    },
  );

  test('rótulos e nomes são Manrope 700', () {
    for (final style in [textTheme.titleSmall!, textTheme.labelMedium!]) {
      expect(style.fontFamily, AppFonts.sans);
      expect(style.fontWeight, FontWeight.w700);
      expect(_wght(style), 700);
    }
  });
}
