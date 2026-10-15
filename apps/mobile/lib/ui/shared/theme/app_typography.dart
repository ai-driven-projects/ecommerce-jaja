import 'package:flutter/material.dart';

import 'app_fonts.dart';

/// A escala de texto do app, a partir do `DESIGN.md` e das classes Tailwind
/// dos componentes do web.
///
/// Duas regras que o Flutter não avisa quando são quebradas:
///
/// 1. As duas famílias são fontes variáveis: cada papel pede o eixo `wght`
///    em `fontVariations`, senão pesos diferentes saem iguais na tela.
/// 2. Os papéis em Bricolage Grotesque pedem também `opsz` igual ao
///    `fontSize`, como o navegador faz (`font-optical-sizing: auto`); sem isso
///    a fonte usa o desenho de display gigante.
class AppTypography {
  AppTypography._();

  /// O `letterSpacing` dos títulos em Bricolage (tracking negativo do web).
  static const double displayLetterSpacing = -0.3;

  static TextTheme textTheme({required Color color}) {
    TextStyle display(double size, double height) => TextStyle(
      fontFamily: AppFonts.display,
      fontSize: size,
      fontWeight: FontWeight.w800,
      fontVariations: [
        const FontVariation('wght', 800),
        FontVariation('opsz', size),
      ],
      height: height,
      letterSpacing: displayLetterSpacing,
      color: color,
    );

    TextStyle sans(
      double size,
      FontWeight weight,
      double height, {
      List<FontFeature>? fontFeatures,
    }) => TextStyle(
      fontFamily: AppFonts.sans,
      fontSize: size,
      fontWeight: weight,
      fontVariations: [FontVariation('wght', weight.value.toDouble())],
      fontFeatures: fontFeatures,
      height: height,
      letterSpacing: 0,
      color: color,
    );

    return TextTheme(
      // Título de página (Bricolage 30).
      displaySmall: display(30, 1.15),
      // Título de seção (Bricolage 24).
      headlineSmall: display(24, 1.2),
      // Título do estado vazio (Bricolage 20).
      titleLarge: display(20, 1.25),
      // Preço do card.
      titleMedium: sans(
        16,
        FontWeight.w800,
        1.25,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
      // Nome do produto no card.
      titleSmall: sans(14, FontWeight.w700, 1.35),
      bodyLarge: sans(15, FontWeight.w400, 1.5),
      // Corpo.
      bodyMedium: sans(14, FontWeight.w400, 1.45),
      // Unidade e legendas.
      bodySmall: sans(12.5, FontWeight.w400, 1.4),
      // Botão.
      labelLarge: sans(14, FontWeight.w800, 1.2),
      // Chip; o rótulo de campo usa 13 via `copyWith`.
      labelMedium: sans(13.5, FontWeight.w700, 1.2),
      // Selo.
      labelSmall: sans(11.5, FontWeight.w800, 1.2),
    );
  }
}

/// Variações da escala que os componentes do web usam e que não têm papel
/// próprio no `TextTheme`. Ficam no tema porque a barreira de estilo proíbe
/// `fontSize:` e `TextStyle(...)` em `widgets/`; a cor fica com o widget.
extension AppTextStyles on TextTheme {
  /// Preço anterior riscado de `price.component.tsx` (600/12.5).
  TextStyle get priceOld => _withWeight(bodySmall!, FontWeight.w600).copyWith(
    decoration: TextDecoration.lineThrough,
    fontFeatures: const [FontFeature.tabularFigures()],
  );

  /// Rótulo acima do campo (13/700, como o checkout do web).
  TextStyle get fieldLabel => labelMedium!.copyWith(fontSize: 13);

  /// Rótulo do chip pequeno (`text-[13px]` do `category-chips`).
  TextStyle get chipSmall => labelMedium!.copyWith(fontSize: 13);

  /// Contagem do chip (`text-xs font-semibold tabular-nums`).
  TextStyle get chipCount => _withWeight(
    bodySmall!,
    FontWeight.w600,
  ).copyWith(fontSize: 12, fontFeatures: const [FontFeature.tabularFigures()]);

  /// Emoji de reserva da área de imagem do card (`text-[46px]`, `md`).
  TextStyle get artEmoji => bodyLarge!.copyWith(fontSize: 46, height: 1);

  /// Emoji do estado vazio (`text-[40px]` do `empty-list-state`).
  TextStyle get emptyEmoji => bodyLarge!.copyWith(fontSize: 40, height: 1);

  // Troca o peso e o eixo `wght` juntos (fonte variável, ver acima).
  static TextStyle _withWeight(TextStyle style, FontWeight weight) =>
      style.copyWith(
        fontWeight: weight,
        fontVariations: [FontVariation('wght', weight.value.toDouble())],
      );
}
