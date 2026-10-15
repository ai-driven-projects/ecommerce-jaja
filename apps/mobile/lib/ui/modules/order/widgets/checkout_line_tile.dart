import 'package:flutter/material.dart';

import '../../../../modules/cart/model/cart_entity.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/product_art.dart';
import '../../cart/view_models/cart_texts.dart';
import '../../catalog/view_models/category_art.dart';

/// Linha do "Resumo do pedido", de `checkout.page.tsx`: foto (ou a
/// ilustração da categoria raiz), nome, "× n" e o total da linha. A linha
/// indisponível fica atenuada, com o selo "Indisponível" (o mesmo da
/// `CartLineTile`) e "Remover" no lugar do total.
class CheckoutLineTile extends StatelessWidget {
  const CheckoutLineTile({
    super.key,
    required this.line,
    required this.onRemove,
  });

  static const String unavailableLabel = CartTexts.unavailableLabel;
  static const String removeLabel = 'Remover';

  /// Lado da foto (`size-11` do web).
  static const double artSize = 44;

  static String quantityLabel(int quantity) => '× $quantity';

  final CartLine line;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final art = categoryArtOf(line.rootCategorySlug);
    final available = line.isAvailable;

    return Row(
      children: [
        Expanded(
          child: Opacity(
            // `opacity-55` do web na linha indisponível.
            opacity: available ? 1 : 0.55,
            child: Row(
              children: [
                SizedBox.square(
                  dimension: artSize,
                  child: ProductArt(
                    imageUrl: line.thumbUrl,
                    emoji: art.emoji,
                    tint: art.tint,
                    size: ProductArtSize.thumb,
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        line.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.titleSmall!.copyWith(
                          color: tokens.ink,
                        ),
                      ),
                      Text(
                        quantityLabel(line.quantity),
                        style: textTheme.bodySmall!.copyWith(
                          color: tokens.mutedInk,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.s12),
        if (available)
          Text(
            formatMoney(line.lineTotal ?? line.price.times(line.quantity)),
            style: textTheme.titleSmall!.copyWith(
              color: tokens.ink,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: tokens.dangerSoft,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.s10,
                    vertical: AppSpacing.s4,
                  ),
                  child: Text(
                    unavailableLabel,
                    style: textTheme.labelSmall!.copyWith(color: tokens.danger),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.s4),
              AppButton(
                label: removeLabel,
                icon: Icons.delete_outline,
                variant: AppButtonVariant.outline,
                size: AppButtonSize.sm,
                onPressed: onRemove,
              ),
            ],
          ),
      ],
    );
  }
}
