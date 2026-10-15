import 'package:flutter/material.dart';

import 'app_button_styles.dart';
import 'app_colors.dart';
import 'app_fonts.dart';
import 'app_radius.dart';
import 'app_spacing.dart';
import 'app_typography.dart';
import 'brand_tokens.dart';

/// O único tema do app: claro, Material 3, com os valores da vitrine web. Não
/// há tema escuro, como no web.
class AppTheme {
  AppTheme._();

  // Montado uma vez: o `MaterialApp` chama `light()` a cada rebuild.
  static final ThemeData _light = _buildLight();

  static ThemeData light() => _light;

  static ThemeData _buildLight() {
    // À mão, não `fromSeed`, que inventaria tons fora da marca.
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.brand,
      onPrimary: AppColors.onBrand,
      primaryContainer: AppColors.brandSoft,
      onPrimaryContainer: AppColors.brandLink,
      secondary: AppColors.success,
      onSecondary: AppColors.onBrand,
      secondaryContainer: AppColors.successSoft,
      onSecondaryContainer: AppColors.successStrong,
      error: AppColors.danger,
      onError: AppColors.onBrand,
      errorContainer: AppColors.dangerSoft,
      onErrorContainer: AppColors.danger,
      surface: AppColors.card,
      onSurface: AppColors.ink,
      onSurfaceVariant: AppColors.mutedInk,
      surfaceContainerLowest: AppColors.card,
      surfaceContainerLow: AppColors.surface,
      surfaceContainer: AppColors.surface,
      surfaceContainerHigh: AppColors.surfaceStrong,
      surfaceContainerHighest: AppColors.surfaceStrong,
      surfaceTint: Colors.transparent,
      outline: AppColors.line,
      outlineVariant: AppColors.line,
      shadow: AppColors.ink,
      inverseSurface: AppColors.dark,
      onInverseSurface: AppColors.onBrand,
      inversePrimary: AppColors.brandLight,
    );
    const tokens = BrandTokens.light;
    final textTheme = AppTypography.textTheme(color: AppColors.ink);

    ButtonStyle button(AppButtonVariant variant) => AppButtonStyles.of(
      variant: variant,
      size: AppButtonSize.md,
      tokens: tokens,
      textTheme: textTheme,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.paper,
      canvasColor: AppColors.paper,
      dividerColor: AppColors.line,
      fontFamily: AppFonts.sans,
      textTheme: textTheme,
      extensions: const [tokens],
      inputDecorationTheme: _inputDecorationTheme(textTheme),
      filledButtonTheme: FilledButtonThemeData(
        style: button(AppButtonVariant.primary),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: button(AppButtonVariant.outline),
      ),
      textButtonTheme: TextButtonThemeData(
        style: button(AppButtonVariant.ghost),
      ),
      navigationBarTheme: _navigationBarTheme(textTheme),
    );
  }

  // Barra de abas: sem referência no web nem nos mockups; segue o chip ativo
  // (fundo `brandSoft`, texto `brand`) sobre o cartão branco.
  static NavigationBarThemeData _navigationBarTheme(TextTheme textTheme) {
    Color colorFor(Set<WidgetState> states) =>
        states.contains(WidgetState.selected)
        ? AppColors.brand
        : AppColors.mutedInk;

    return NavigationBarThemeData(
      height: 64,
      backgroundColor: AppColors.card,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.brandSoft,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(color: colorFor(states)),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => textTheme.labelMedium!.copyWith(color: colorFor(states)),
      ),
    );
  }

  // Campo de `input.tsx`: branco, borda 1.5 em linha, raio 14, altura 44,
  // padding horizontal 14; foco laranja, erro em perigo.
  static InputDecorationTheme _inputDecorationTheme(TextTheme textTheme) {
    OutlineInputBorder border(Color color) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.xl),
      borderSide: BorderSide(color: color, width: 1.5),
    );

    return InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      isDense: true,
      constraints: const BoxConstraints(minHeight: 44),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s14,
        vertical: AppSpacing.s12,
      ),
      border: border(AppColors.line),
      enabledBorder: border(AppColors.line),
      disabledBorder: border(AppColors.line),
      focusedBorder: border(AppColors.brand),
      errorBorder: border(AppColors.danger),
      focusedErrorBorder: border(AppColors.danger),
      hintStyle: textTheme.bodyMedium!.copyWith(color: AppColors.placeholder),
      errorStyle: textTheme.bodySmall!.copyWith(color: AppColors.danger),
    );
  }
}
