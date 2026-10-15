import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/shared/theme/app_radius.dart';
import 'package:mobile/ui/shared/theme/brand_tokens.dart';

void main() {
  const tokens = BrandTokens.light;

  test('as cores têm os mesmos hex do globals.css do web', () {
    final expected = <String, (Color, int)>{
      'line': (tokens.line, 0xFFEFE9E2),
      'success': (tokens.success, 0xFF0E9F5D),
      'danger': (tokens.danger, 0xFFC93A31),
      'tintPeach': (tokens.tintPeach, 0xFFFFF1E6),
      'brand': (tokens.brand, 0xFFFF6B00),
      'paper': (tokens.paper, 0xFFFAF8F5),
      'ink': (tokens.ink, 0xFF1E1812),
      'card': (tokens.card, 0xFFFFFFFF),
      'surface': (tokens.surface, 0xFFF6F1EA),
      'placeholder': (tokens.placeholder, 0xFFB8AFA4),
      'dangerStrong': (tokens.dangerStrong, 0xFFB02F27),
      'onBrand': (tokens.onBrand, 0xFFFFFFFF),
    };

    for (final MapEntry(key: name, value: (color, hex)) in expected.entries) {
      expect(color.toARGB32(), hex, reason: 'Token $name');
    }
  });

  test('as cores com alfa do bloco escuro vêm resolvidas', () {
    expect(tokens.darkLine.toARGB32() & 0x00FFFFFF, 0xFFFFFF);
    expect(tokens.darkLine.a, closeTo(0.08, 0.005));
    expect(tokens.darkSurface.a, closeTo(0.1, 0.005));
  });

  test('os raios têm os valores em pixels do web', () {
    expect(
      [
        AppRadius.xs,
        AppRadius.sm,
        AppRadius.md,
        AppRadius.lg,
        AppRadius.xl,
        AppRadius.xl2,
        AppRadius.xl3,
        AppRadius.xl4,
        AppRadius.pill,
      ],
      [6, 8, 10, 12, 14, 18, 20, 24, 999],
    );
  });

  test('as sombras copiam o globals.css', () {
    final brand = tokens.shadowBrand.single;
    expect(brand.offset, const Offset(0, 4));
    expect(brand.blurRadius, 14);
    expect(brand.color, const Color.fromRGBO(255, 107, 0, 0.28));
    expect(tokens.shadowCard.single.blurRadius, 26);
    expect(tokens.shadowFloat.single.offset, const Offset(0, 6));
    expect(tokens.shadowBadge.single.blurRadius, 6);
  });

  test('lerp entre tokens iguais devolve os mesmos valores', () {
    for (final t in [0.0, 0.5, 1.0]) {
      final result = tokens.lerp(tokens, t);
      expect(result.brand, tokens.brand);
      expect(result.line, tokens.line);
      expect(result.tintGreen, tokens.tintGreen);
      expect(result.darkSurface, tokens.darkSurface);
      expect(result.shadowCard, tokens.shadowCard);
      expect(result.shadowBadge, tokens.shadowBadge);
    }
  });

  test('copyWith troca só o que recebe', () {
    final copy = tokens.copyWith(brand: tokens.danger);
    expect(copy.brand, tokens.danger);
    expect(copy.paper, tokens.paper);
    expect(copy.shadowBrand, tokens.shadowBrand);
  });
}
