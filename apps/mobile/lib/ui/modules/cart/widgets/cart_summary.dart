import 'package:flutter/material.dart';

import '../../../../core/value_objects/money.dart';
import '../../../../modules/cart/model/cart_entity.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Resumo da aba Carrinho, do rodapé de `cart-drawer.component.tsx`:
/// subtotal, entrega ("Grátis" ou o valor), quanto falta para a entrega
/// grátis enquanto ela é cobrada e o total, todos da última prévia. Com
/// [isSyncing] (mudança ainda não confirmada), os valores ficam atenuados e
/// anunciados como "Atualizando".
///
/// [CartSummary.checkout] é o resumo do checkout (`checkout.page.tsx`):
/// "Entrega de bike", sem quanto falta para a entrega grátis e sem o aviso de
/// indisponíveis (o checkout tem o seu, abaixo do botão).
class CartSummary extends StatelessWidget {
  const CartSummary({super.key, required this.detail, required this.isSyncing})
    : _checkout = false;

  const CartSummary.checkout({
    super.key,
    required this.detail,
    required this.isSyncing,
  }) : _checkout = true;

  static const String subtotalLabel = 'Subtotal';
  static const String deliveryLabel = 'Entrega';
  static const String checkoutDeliveryLabel = 'Entrega de bike';
  static const String freeDeliveryLabel = 'Grátis';
  static const String totalLabel = 'Total';
  static const String syncingLabel = 'Atualizando';
  static const String unavailableWarning =
      'Remova os itens indisponíveis para continuar.';

  static String missingForFreeDelivery(Money missing) =>
      'Faltam ${formatMoney(missing)} para a entrega grátis.';

  final CartDetail detail;
  final bool isSyncing;
  final bool _checkout;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final labelStyle = textTheme.bodyMedium!.copyWith(color: tokens.mutedInk);
    final valueStyle = textTheme.titleSmall!.copyWith(
      color: tokens.ink,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final isFree = detail.deliveryFee.cents == 0;

    final values = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _row(
          Text(subtotalLabel, style: labelStyle),
          Text(formatMoney(detail.subtotal), style: valueStyle),
        ),
        const SizedBox(height: AppSpacing.s8),
        _row(
          Text(
            _checkout ? checkoutDeliveryLabel : deliveryLabel,
            style: labelStyle,
          ),
          isFree
              ? Text(
                  freeDeliveryLabel,
                  style: textTheme.titleSmall!.copyWith(color: tokens.success),
                )
              : Text(formatMoney(detail.deliveryFee), style: valueStyle),
        ),
        if (!isFree && !_checkout) ...[
          const SizedBox(height: AppSpacing.s8),
          Text(
            missingForFreeDelivery(detail.missingForFreeDelivery),
            style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
          ),
        ],
        const SizedBox(height: AppSpacing.s12),
        _row(
          Text(
            totalLabel,
            style: textTheme.titleMedium!.copyWith(color: tokens.ink),
          ),
          Text(
            formatMoney(detail.total),
            style: textTheme.titleMedium!.copyWith(
              color: tokens.ink,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isSyncing)
          Semantics(
            label: syncingLabel,
            // `opacity-50` do web enquanto os valores não são confirmados.
            child: Opacity(opacity: 0.5, child: values),
          )
        else
          values,
        if (detail.hasUnavailableItems && !_checkout) ...[
          const SizedBox(height: AppSpacing.s12),
          Text(
            unavailableWarning,
            style: textTheme.bodySmall!.copyWith(color: tokens.danger),
          ),
        ],
      ],
    );
  }

  Widget _row(Widget label, Widget value) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [label, value],
  );
}
