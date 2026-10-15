import 'dart:ui';

/// As cores de `:root` em `apps/frontend/src/app/globals.css`, com o nome do
/// token do web. Telas e widgets não leem daqui: leem de `context.tokens`
/// (`brand_tokens.dart`) ou do `ColorScheme`.
///
/// Ficam de fora o que o app não usa: `--map` (sem mapa), as sombras
/// `--shadow-drawer` e `--shadow-deep` e os aliases semânticos/`--chart-*`.
class AppColors {
  AppColors._();

  // Superfícies e texto
  static const Color paper = Color(0xFFFAF8F5);
  static const Color card = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF6F1EA);
  static const Color surfaceStrong = Color(0xFFF0E9E0);
  static const Color line = Color(0xFFEFE9E2);
  static const Color ink = Color(0xFF1E1812);
  static const Color inkSoft = Color(0xFF5C544B);
  static const Color mutedInk = Color(0xFF8A8177);
  static const Color placeholder = Color(0xFFB8AFA4);

  // Marca (laranja)
  static const Color brand = Color(0xFFFF6B00);
  static const Color brandStrong = Color(0xFFE85F00);
  static const Color brandLink = Color(0xFFD95B00);
  static const Color brandLight = Color(0xFFFF8A3D);
  static const Color brandSoft = Color(0xFFFFF1E6);
  static const Color brandPale = Color(0xFFFFD9BD);

  /// `--primary-foreground`: o texto branco sobre o laranja (e sobre o perigo).
  static const Color onBrand = Color(0xFFFFFFFF);

  // Estados
  static const Color success = Color(0xFF0E9F5D);
  static const Color successStrong = Color(0xFF0B7A47);
  static const Color successSoft = Color(0xFFE7F6EE);
  static const Color successLight = Color(0xFF7ED9A9);
  static const Color warning = Color(0xFFB78A00);
  static const Color warningSoft = Color(0xFFFFF7DD);
  static const Color danger = Color(0xFFC93A31);
  static const Color dangerSoft = Color(0xFFFDEBEA);

  /// Literal do `hover:bg-[#b02f27]` da variante `danger` em `button.tsx`; no
  /// app é o pressionado do botão de perigo.
  static const Color dangerStrong = Color(0xFFB02F27);

  // Blocos escuros (hero, ETA)
  static const Color dark = Color(0xFF1E1812);
  static const Color darkMuted = Color(0xFFB8AFA4);
  static const Color darkLine = Color.fromRGBO(255, 255, 255, 0.08);
  static const Color darkSurface = Color.fromRGBO(255, 255, 255, 0.1);

  // Tons pastéis das áreas de imagem e ícones
  static const Color tintBlue = Color(0xFFEAF4FF);
  static const Color tintPurple = Color(0xFFF5EFFF);
  static const Color tintMint = Color(0xFFEAF7F3);
  static const Color tintYellow = Color(0xFFFFF7DD);
  static const Color tintPeach = Color(0xFFFFF1E6);
  static const Color tintGreen = Color(0xFFF0F7EA);
}
