import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Os tokens da marca que o `ColorScheme` não comporta: todas as cores do
/// `globals.css` e as quatro sombras. Telas e widgets leem por
/// `context.tokens`.
class BrandTokens extends ThemeExtension<BrandTokens> {
  const BrandTokens({
    required this.paper,
    required this.card,
    required this.surface,
    required this.surfaceStrong,
    required this.line,
    required this.ink,
    required this.inkSoft,
    required this.mutedInk,
    required this.placeholder,
    required this.brand,
    required this.brandStrong,
    required this.brandLink,
    required this.brandLight,
    required this.brandSoft,
    required this.brandPale,
    required this.onBrand,
    required this.success,
    required this.successStrong,
    required this.successSoft,
    required this.successLight,
    required this.warning,
    required this.warningSoft,
    required this.danger,
    required this.dangerSoft,
    required this.dangerStrong,
    required this.dark,
    required this.darkMuted,
    required this.darkLine,
    required this.darkSurface,
    required this.tintBlue,
    required this.tintPurple,
    required this.tintMint,
    required this.tintYellow,
    required this.tintPeach,
    required this.tintGreen,
    required this.shadowCard,
    required this.shadowBrand,
    required this.shadowFloat,
    required this.shadowBadge,
  });

  // Superfícies e texto
  final Color paper;
  final Color card;
  final Color surface;
  final Color surfaceStrong;
  final Color line;
  final Color ink;
  final Color inkSoft;
  final Color mutedInk;
  final Color placeholder;

  // Marca
  final Color brand;
  final Color brandStrong;
  final Color brandLink;
  final Color brandLight;
  final Color brandSoft;
  final Color brandPale;
  final Color onBrand;

  // Estados
  final Color success;
  final Color successStrong;
  final Color successSoft;
  final Color successLight;
  final Color warning;
  final Color warningSoft;
  final Color danger;
  final Color dangerSoft;
  final Color dangerStrong;

  // Blocos escuros
  final Color dark;
  final Color darkMuted;
  final Color darkLine;
  final Color darkSurface;

  // Tons pastéis das áreas de imagem
  final Color tintBlue;
  final Color tintPurple;
  final Color tintMint;
  final Color tintYellow;
  final Color tintPeach;
  final Color tintGreen;

  // Sombras: `--shadow-card`, `--shadow-brand` (botão primário),
  // `--shadow-float` e `--shadow-badge` (selo "Destaque").
  final List<BoxShadow> shadowCard;
  final List<BoxShadow> shadowBrand;
  final List<BoxShadow> shadowFloat;
  final List<BoxShadow> shadowBadge;

  static const BrandTokens light = BrandTokens(
    paper: AppColors.paper,
    card: AppColors.card,
    surface: AppColors.surface,
    surfaceStrong: AppColors.surfaceStrong,
    line: AppColors.line,
    ink: AppColors.ink,
    inkSoft: AppColors.inkSoft,
    mutedInk: AppColors.mutedInk,
    placeholder: AppColors.placeholder,
    brand: AppColors.brand,
    brandStrong: AppColors.brandStrong,
    brandLink: AppColors.brandLink,
    brandLight: AppColors.brandLight,
    brandSoft: AppColors.brandSoft,
    brandPale: AppColors.brandPale,
    onBrand: AppColors.onBrand,
    success: AppColors.success,
    successStrong: AppColors.successStrong,
    successSoft: AppColors.successSoft,
    successLight: AppColors.successLight,
    warning: AppColors.warning,
    warningSoft: AppColors.warningSoft,
    danger: AppColors.danger,
    dangerSoft: AppColors.dangerSoft,
    dangerStrong: AppColors.dangerStrong,
    dark: AppColors.dark,
    darkMuted: AppColors.darkMuted,
    darkLine: AppColors.darkLine,
    darkSurface: AppColors.darkSurface,
    tintBlue: AppColors.tintBlue,
    tintPurple: AppColors.tintPurple,
    tintMint: AppColors.tintMint,
    tintYellow: AppColors.tintYellow,
    tintPeach: AppColors.tintPeach,
    tintGreen: AppColors.tintGreen,
    shadowCard: [
      BoxShadow(
        color: AppColors.shadowCard,
        offset: Offset(0, 10),
        blurRadius: 26,
      ),
    ],
    shadowBrand: [
      BoxShadow(
        color: AppColors.shadowBrand,
        offset: Offset(0, 4),
        blurRadius: 14,
      ),
    ],
    shadowFloat: [
      BoxShadow(
        color: AppColors.shadowFloat,
        offset: Offset(0, 6),
        blurRadius: 18,
      ),
    ],
    shadowBadge: [
      BoxShadow(
        color: AppColors.shadowBadge,
        offset: Offset(0, 2),
        blurRadius: 6,
      ),
    ],
  );

  @override
  BrandTokens copyWith({
    Color? paper,
    Color? card,
    Color? surface,
    Color? surfaceStrong,
    Color? line,
    Color? ink,
    Color? inkSoft,
    Color? mutedInk,
    Color? placeholder,
    Color? brand,
    Color? brandStrong,
    Color? brandLink,
    Color? brandLight,
    Color? brandSoft,
    Color? brandPale,
    Color? onBrand,
    Color? success,
    Color? successStrong,
    Color? successSoft,
    Color? successLight,
    Color? warning,
    Color? warningSoft,
    Color? danger,
    Color? dangerSoft,
    Color? dangerStrong,
    Color? dark,
    Color? darkMuted,
    Color? darkLine,
    Color? darkSurface,
    Color? tintBlue,
    Color? tintPurple,
    Color? tintMint,
    Color? tintYellow,
    Color? tintPeach,
    Color? tintGreen,
    List<BoxShadow>? shadowCard,
    List<BoxShadow>? shadowBrand,
    List<BoxShadow>? shadowFloat,
    List<BoxShadow>? shadowBadge,
  }) {
    return BrandTokens(
      paper: paper ?? this.paper,
      card: card ?? this.card,
      surface: surface ?? this.surface,
      surfaceStrong: surfaceStrong ?? this.surfaceStrong,
      line: line ?? this.line,
      ink: ink ?? this.ink,
      inkSoft: inkSoft ?? this.inkSoft,
      mutedInk: mutedInk ?? this.mutedInk,
      placeholder: placeholder ?? this.placeholder,
      brand: brand ?? this.brand,
      brandStrong: brandStrong ?? this.brandStrong,
      brandLink: brandLink ?? this.brandLink,
      brandLight: brandLight ?? this.brandLight,
      brandSoft: brandSoft ?? this.brandSoft,
      brandPale: brandPale ?? this.brandPale,
      onBrand: onBrand ?? this.onBrand,
      success: success ?? this.success,
      successStrong: successStrong ?? this.successStrong,
      successSoft: successSoft ?? this.successSoft,
      successLight: successLight ?? this.successLight,
      warning: warning ?? this.warning,
      warningSoft: warningSoft ?? this.warningSoft,
      danger: danger ?? this.danger,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      dangerStrong: dangerStrong ?? this.dangerStrong,
      dark: dark ?? this.dark,
      darkMuted: darkMuted ?? this.darkMuted,
      darkLine: darkLine ?? this.darkLine,
      darkSurface: darkSurface ?? this.darkSurface,
      tintBlue: tintBlue ?? this.tintBlue,
      tintPurple: tintPurple ?? this.tintPurple,
      tintMint: tintMint ?? this.tintMint,
      tintYellow: tintYellow ?? this.tintYellow,
      tintPeach: tintPeach ?? this.tintPeach,
      tintGreen: tintGreen ?? this.tintGreen,
      shadowCard: shadowCard ?? this.shadowCard,
      shadowBrand: shadowBrand ?? this.shadowBrand,
      shadowFloat: shadowFloat ?? this.shadowFloat,
      shadowBadge: shadowBadge ?? this.shadowBadge,
    );
  }

  @override
  BrandTokens lerp(covariant ThemeExtension<BrandTokens>? other, double t) {
    if (other is! BrandTokens) return this;

    return BrandTokens(
      paper: Color.lerp(paper, other.paper, t)!,
      card: Color.lerp(card, other.card, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceStrong: Color.lerp(surfaceStrong, other.surfaceStrong, t)!,
      line: Color.lerp(line, other.line, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkSoft: Color.lerp(inkSoft, other.inkSoft, t)!,
      mutedInk: Color.lerp(mutedInk, other.mutedInk, t)!,
      placeholder: Color.lerp(placeholder, other.placeholder, t)!,
      brand: Color.lerp(brand, other.brand, t)!,
      brandStrong: Color.lerp(brandStrong, other.brandStrong, t)!,
      brandLink: Color.lerp(brandLink, other.brandLink, t)!,
      brandLight: Color.lerp(brandLight, other.brandLight, t)!,
      brandSoft: Color.lerp(brandSoft, other.brandSoft, t)!,
      brandPale: Color.lerp(brandPale, other.brandPale, t)!,
      onBrand: Color.lerp(onBrand, other.onBrand, t)!,
      success: Color.lerp(success, other.success, t)!,
      successStrong: Color.lerp(successStrong, other.successStrong, t)!,
      successSoft: Color.lerp(successSoft, other.successSoft, t)!,
      successLight: Color.lerp(successLight, other.successLight, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningSoft: Color.lerp(warningSoft, other.warningSoft, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      dangerSoft: Color.lerp(dangerSoft, other.dangerSoft, t)!,
      dangerStrong: Color.lerp(dangerStrong, other.dangerStrong, t)!,
      dark: Color.lerp(dark, other.dark, t)!,
      darkMuted: Color.lerp(darkMuted, other.darkMuted, t)!,
      darkLine: Color.lerp(darkLine, other.darkLine, t)!,
      darkSurface: Color.lerp(darkSurface, other.darkSurface, t)!,
      tintBlue: Color.lerp(tintBlue, other.tintBlue, t)!,
      tintPurple: Color.lerp(tintPurple, other.tintPurple, t)!,
      tintMint: Color.lerp(tintMint, other.tintMint, t)!,
      tintYellow: Color.lerp(tintYellow, other.tintYellow, t)!,
      tintPeach: Color.lerp(tintPeach, other.tintPeach, t)!,
      tintGreen: Color.lerp(tintGreen, other.tintGreen, t)!,
      shadowCard: BoxShadow.lerpList(shadowCard, other.shadowCard, t)!,
      shadowBrand: BoxShadow.lerpList(shadowBrand, other.shadowBrand, t)!,
      shadowFloat: BoxShadow.lerpList(shadowFloat, other.shadowFloat, t)!,
      shadowBadge: BoxShadow.lerpList(shadowBadge, other.shadowBadge, t)!,
    );
  }
}

extension BrandTokensContext on BuildContext {
  /// Os tokens da marca do tema atual.
  BrandTokens get tokens => Theme.of(this).extension<BrandTokens>()!;
}
