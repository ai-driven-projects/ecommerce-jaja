import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_typography.dart';
import '../theme/brand_tokens.dart';

/// Os seis tons pastéis das áreas de imagem (`--tint-*` do web). O mapa da
/// categoria raiz para o tom (`category-art.ts`) chega na etapa 5.
enum ProductArtTint { blue, purple, mint, yellow, peach, green }

extension ProductArtTintColor on ProductArtTint {
  Color colorIn(BrandTokens tokens) => switch (this) {
    ProductArtTint.blue => tokens.tintBlue,
    ProductArtTint.purple => tokens.tintPurple,
    ProductArtTint.mint => tokens.tintMint,
    ProductArtTint.yellow => tokens.tintYellow,
    ProductArtTint.peach => tokens.tintPeach,
    ProductArtTint.green => tokens.tintGreen,
  };
}

/// Área de imagem do produto, de `product-art.component.tsx` (tamanho `md`):
/// a foto inteira (`BoxFit.contain`) sobre branco, com respiro de 8. Sem foto,
/// ou quando ela não carrega, o emoji grande sobre o tom pastel (padrão 🛒
/// sobre o verde). [badge] fica no canto superior esquerdo.
///
/// É decorativa para leitores de tela (o `aria-hidden` do web): quem a usa
/// anuncia o nome do produto.
class ProductArt extends StatelessWidget {
  const ProductArt({
    super.key,
    this.imageUrl,
    this.emoji,
    this.tint = ProductArtTint.green,
    this.badge,
  });

  /// Altura da área no card (`h-[120px]`).
  static const double height = 120;

  /// Emoji de reserva quando nenhum é informado.
  static const String defaultEmoji = '🛒';

  final String? imageUrl;
  final String? emoji;
  final ProductArtTint tint;
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final imageUrl = this.imageUrl;
    final badge = this.badge;

    final fallback = ColoredBox(
      color: tint.colorIn(tokens),
      child: Center(
        child: ExcludeSemantics(
          child: Text(
            emoji ?? defaultEmoji,
            style: Theme.of(context).textTheme.artEmoji,
          ),
        ),
      ),
    );

    return SizedBox(
      height: height,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl == null)
              fallback
            else
              Image.network(
                imageUrl,
                fit: BoxFit.contain,
                excludeFromSemantics: true,
                // O `errorBuilder` devolve direto, sem passar por aqui: a
                // reserva ocupa a área inteira, sem o respiro branco.
                frameBuilder: (_, child, _, _) => ColoredBox(
                  color: tokens.card,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: child,
                  ),
                ),
                errorBuilder: (_, _, _) => fallback,
              ),
            if (badge != null) Positioned(left: 8, top: 8, child: badge),
          ],
        ),
      ),
    );
  }
}
