import 'package:flutter/material.dart';

import '../../../../modules/cart/model/cart_entity.dart';
import '../../../../modules/cart/model/cart_rules.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/price_text.dart';
import '../../../shared/widgets/product_art.dart';
import '../../../shared/widgets/quantity_stepper.dart';
import '../../catalog/view_models/category_art.dart';
import '../view_models/cart_texts.dart';

/// Linha da aba Carrinho, do `CartLineRow` de `cart-drawer.component.tsx`:
/// foto (ou a ilustração da categoria raiz), nome que abre o produto, unidade,
/// preço, controle de quantidade, total da linha e a lixeira. "−" em 1 pede
/// quantidade 0 (remove) e o "+" para no limite por produto. Linha
/// indisponível fica atenuada, com o selo "Indisponível" e "Remover", sem
/// controle nem total.
class CartLineTile extends StatelessWidget {
  const CartLineTile({
    super.key,
    required this.line,
    required this.onOpenProduct,
    required this.onChangeQuantity,
    required this.onRemove,
  });

  static const String unavailableLabel = CartTexts.unavailableLabel;
  static const String removeLabel = 'Remover';

  static String removeTooltip(String name) => 'Remover $name do carrinho';

  /// Lado da foto (`size="sm"` do web, maior no app).
  static const double artSize = 64;

  final CartLine line;

  /// Abre o produto pelo slug.
  final ValueChanged<String> onOpenProduct;

  /// Pede a nova quantidade do produto; 0 o remove.
  final ValueChanged<int> onChangeQuantity;

  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final art = categoryArtOf(line.rootCategorySlug);
    final available = line.isAvailable;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Opacity(
          // `opacity-55` do web na linha indisponível.
          opacity: available ? 1 : 0.55,
          child: SizedBox.square(
            dimension: artSize,
            child: ProductArt(
              imageUrl: line.thumbUrl,
              emoji: art.emoji,
              tint: art.tint,
              size: ProductArtSize.thumb,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.s12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                link: true,
                child: InkWell(
                  onTap: () => onOpenProduct(line.slug),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: QuantityStepper.minTapTarget,
                      minWidth: double.infinity,
                    ),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        line.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: textTheme.titleSmall!.copyWith(
                          color: tokens.ink,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Text(
                line.unit,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
              ),
              const SizedBox(height: AppSpacing.s4),
              PriceText(
                price: line.price,
                previousPrice: line.listPrice,
                style: textTheme.titleSmall,
              ),
              const SizedBox(height: AppSpacing.s8),
              if (available)
                Row(
                  children: [
                    QuantityStepper(
                      quantity: line.quantity,
                      itemName: line.name,
                      onDecrement: () => onChangeQuantity(line.quantity - 1),
                      onIncrement: line.quantity < cartItemMaxQuantity
                          ? () => onChangeQuantity(line.quantity + 1)
                          : null,
                    ),
                    const Spacer(),
                    // Preço da prévia × quantidade local: acompanha o "+" na
                    // hora, como a API calcula.
                    Text(
                      formatMoney(line.price.times(line.quantity)),
                      style: textTheme.titleSmall!.copyWith(
                        color: tokens.ink,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                )
              else
                Row(
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
                          style: textTheme.labelSmall!.copyWith(
                            color: tokens.danger,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
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
          ),
        ),
        if (available)
          IconButton(
            tooltip: removeTooltip(line.name),
            onPressed: onRemove,
            color: tokens.mutedInk,
            icon: const Icon(Icons.delete_outline),
          ),
      ],
    );
  }
}
