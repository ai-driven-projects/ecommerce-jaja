import 'package:flutter/material.dart';

import '../../../core/value_objects/money.dart';
import '../theme/app_radius.dart';
import '../theme/brand_tokens.dart';
import 'price_text.dart';
import 'product_art.dart';
import 'product_badge.dart';

export 'product_art.dart' show ProductArtTint;

/// Card de produto de `product-card.component.tsx`: cartão branco com borda
/// de linha e raio 18, área de imagem, nome em até 3 linhas, unidade e preço.
/// Recebe valores de apresentação (o domínio do catálogo nasce na etapa 5) e
/// o desconto já calculado pela API.
///
/// Um único selo na imagem: `−N%` quando há desconto, senão "Destaque".
/// [action] (o "+" ou o stepper da etapa 9) só aparece quando fornecida.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.name,
    required this.unit,
    required this.price,
    required this.onTap,
    this.previousPrice,
    this.discountPercent,
    this.featured = false,
    this.imageUrl,
    this.emoji,
    this.tint = ProductArtTint.green,
    this.action,
  });

  final String name;
  final String unit;
  final Money price;

  /// Abre o produto.
  final VoidCallback onTap;
  final Money? previousPrice;

  /// Desconto em pontos percentuais, como a API manda; o card não calcula.
  final int? discountPercent;
  final bool featured;
  final String? imageUrl;

  /// Emoji de reserva; sem ele, 🛒.
  final String? emoji;
  final ProductArtTint tint;

  /// Controle ao lado do preço.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final discount = discountPercent;
    final action = this.action;

    final Widget? badge = discount != null && discount > 0
        ? ProductBadge(label: '−$discount%', variant: ProductBadgeVariant.solid)
        : featured
        ? const ProductBadge(label: 'Destaque')
        : null;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tokens.card,
          border: Border.all(color: tokens.line),
          borderRadius: BorderRadius.circular(AppRadius.xl2),
        ),
        child: Padding(
          // `p-3 gap-2.5` do web.
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              ProductArt(
                imageUrl: imageUrl,
                emoji: emoji,
                tint: tint,
                badge: badge,
              ),
              const SizedBox(height: 10),
              Semantics(
                container: true,
                label: name,
                excludeSemantics: true,
                child: Text(
                  name,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleSmall!.copyWith(color: tokens.ink),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                unit,
                style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: PriceText(
                      price: price,
                      previousPrice: previousPrice,
                    ),
                  ),
                  if (action != null) ...[const SizedBox(width: 8), action],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
