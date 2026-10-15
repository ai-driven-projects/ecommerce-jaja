import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_typography.dart';
import '../theme/brand_tokens.dart';

/// Os seis tons pastéis das áreas de imagem (`--tint-*` do web). O mapa da
/// categoria raiz para o tom é `categoryArtOf`, em
/// `ui/modules/catalog/view_models/category_art.dart`.
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

/// Tamanhos da área de imagem. [card] é o `md` de `product-art.component.tsx`
/// (altura fixa, raio 14); [gallery] (o `xl`, `rounded-4xl`) e [thumb] (a
/// miniatura da galeria, `rounded-lg`) preenchem o pai, que decide a medida.
enum ProductArtSize { card, gallery, thumb }

/// Área de imagem do produto, de `product-art.component.tsx`: a foto inteira (`BoxFit.contain`) sobre branco, com respiro de 8, lida pelo
/// cache de imagens do aparelho (uma foto já baixada não é pedida de novo).
/// Enquanto ela chega, a área branca vazia. Sem foto, ou quando ela não
/// carrega, o emoji grande sobre o tom pastel (padrão 🛒 sobre o verde).
/// [badge] fica no canto superior esquerdo.
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
    this.size = ProductArtSize.card,
  });

  /// Altura da área no card (`h-[120px]`).
  static const double height = 120;

  /// Emoji de reserva quando nenhum é informado.
  static const String defaultEmoji = '🛒';

  final String? imageUrl;
  final String? emoji;
  final ProductArtTint tint;
  final Widget? badge;
  final ProductArtSize size;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final imageUrl = this.imageUrl;
    final badge = this.badge;
    final textTheme = Theme.of(context).textTheme;

    final fallback = ColoredBox(
      color: tint.colorIn(tokens),
      child: Center(
        child: ExcludeSemantics(
          child: Text(
            emoji ?? defaultEmoji,
            style: switch (size) {
              ProductArtSize.card => textTheme.artEmoji,
              ProductArtSize.gallery => textTheme.artEmojiLarge,
              ProductArtSize.thumb => textTheme.artEmojiThumb,
            },
          ),
        ),
      ),
    );

    final area = ClipRRect(
      borderRadius: BorderRadius.circular(switch (size) {
        ProductArtSize.card => AppRadius.xl,
        ProductArtSize.gallery => AppRadius.xl4,
        ProductArtSize.thumb => AppRadius.lg,
      }),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrl == null)
            fallback
          else
            ExcludeSemantics(
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.contain,
                // A reserva ocupa a área inteira, sem o respiro branco; só a
                // foto passa pelo `imageBuilder`.
                imageBuilder: (_, provider) => ColoredBox(
                  color: tokens.card,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Image(image: provider, fit: BoxFit.contain),
                  ),
                ),
                placeholder: (_, _) => ColoredBox(color: tokens.card),
                errorWidget: (_, _, _) => fallback,
              ),
            ),
          if (badge != null) Positioned(left: 8, top: 8, child: badge),
        ],
      ),
    );

    return switch (size) {
      ProductArtSize.card => SizedBox(
        height: height,
        width: double.infinity,
        child: area,
      ),
      ProductArtSize.gallery ||
      ProductArtSize.thumb => SizedBox.expand(child: area),
    };
  }
}
