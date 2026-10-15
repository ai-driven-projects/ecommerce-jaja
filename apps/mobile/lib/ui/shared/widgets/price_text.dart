import 'package:flutter/material.dart';

import '../../../core/value_objects/money.dart';
import '../formatters/money_formatter.dart';
import '../theme/app_typography.dart';
import '../theme/brand_tokens.dart';

/// Preço no formato `R$ 12,90`, como `price.component.tsx`: em oferta (preço
/// anterior maior que o atual), o anterior aparece riscado antes e o atual
/// fica laranja. Anterior igual ou menor é ignorado.
class PriceText extends StatelessWidget {
  const PriceText({
    super.key,
    required this.price,
    this.previousPrice,
    this.style,
  });

  final Money price;
  final Money? previousPrice;

  /// Estilo do tema para o preço atual; padrão `titleMedium` (preço do card).
  /// Os algarismos são sempre tabulares.
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final previous = previousPrice;
    final onSale = previous != null && previous > price;
    final currentStyle = (style ?? textTheme.titleMedium!).copyWith(
      color: onSale ? tokens.brand : tokens.ink,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    return Wrap(
      // `gap-x-1.5` do web.
      spacing: 6,
      crossAxisAlignment: WrapCrossAlignment.end,
      children: [
        if (onSale)
          Text(
            formatMoney(previous),
            style: textTheme.priceOld.copyWith(color: tokens.placeholder),
          ),
        Text(formatMoney(price), style: currentStyle),
      ],
    );
  }
}
