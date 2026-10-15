import 'package:flutter/material.dart';

import 'brand_tokens.dart';

/// As variantes do botão em pílula, de `button.tsx` do web.
enum AppButtonVariant { primary, secondary, outline, ghost, danger }

/// Os tamanhos do botão: `sm`, `default`, `lg` e `xl` do `button.tsx`.
enum AppButtonSize {
  sm(height: 36, horizontalPadding: 16, fontSize: 13),
  md(height: 40, horizontalPadding: 18, fontSize: 14),
  lg(height: 48, horizontalPadding: 24, fontSize: 15),
  xl(height: 52, horizontalPadding: 28, fontSize: 15.5);

  const AppButtonSize({
    required this.height,
    required this.horizontalPadding,
    required this.fontSize,
  });

  final double height;
  final double horizontalPadding;
  final double fontSize;
}

/// Os `ButtonStyle` de cada variante e tamanho. Ficam na camada de tema porque
/// a barreira de estilo proíbe `styleFrom`/cor literal em `widgets/`.
///
/// O pressionado usa a cor de hover do web. O estilo não muda quando o botão
/// está indisponível: quem atenua (opacidade 0.5) e tira a sombra da marca é o
/// widget, como o `disabled:opacity-50` do web. A sombra do primário também é
/// do widget (`DecoratedBox`), porque `ButtonStyle` não aceita `BoxShadow`.
class AppButtonStyles {
  AppButtonStyles._();

  static ButtonStyle of({
    required AppButtonVariant variant,
    required AppButtonSize size,
    required BrandTokens tokens,
    required TextTheme textTheme,
  }) {
    final (background, pressed, foreground, border) = switch (variant) {
      AppButtonVariant.primary => (
        tokens.brand,
        tokens.brandStrong,
        tokens.onBrand,
        null,
      ),
      AppButtonVariant.secondary => (
        tokens.surface,
        tokens.surfaceStrong,
        tokens.ink,
        tokens.line,
      ),
      AppButtonVariant.outline => (
        tokens.card,
        tokens.surface,
        tokens.ink,
        tokens.line,
      ),
      AppButtonVariant.ghost => (
        Colors.transparent,
        tokens.surface,
        tokens.ink,
        null,
      ),
      AppButtonVariant.danger => (
        tokens.danger,
        tokens.dangerStrong,
        tokens.onBrand,
        null,
      ),
    };

    return ButtonStyle(
      backgroundColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.pressed) ? pressed : background,
      ),
      foregroundColor: WidgetStatePropertyAll(foreground),
      iconColor: WidgetStatePropertyAll(foreground),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      shadowColor: const WidgetStatePropertyAll(Colors.transparent),
      surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
      elevation: const WidgetStatePropertyAll(0),
      textStyle: WidgetStatePropertyAll(
        textTheme.labelLarge!.copyWith(fontSize: size.fontSize),
      ),
      padding: WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: size.horizontalPadding),
      ),
      minimumSize: WidgetStatePropertyAll(Size(0, size.height)),
      maximumSize: WidgetStatePropertyAll(Size(double.infinity, size.height)),
      iconSize: const WidgetStatePropertyAll(18),
      side: WidgetStatePropertyAll(
        border == null ? BorderSide.none : BorderSide(color: border),
      ),
      shape: const WidgetStatePropertyAll(StadiumBorder()),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.standard,
      splashFactory: NoSplash.splashFactory,
    );
  }
}
