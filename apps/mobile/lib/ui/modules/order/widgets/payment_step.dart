import 'package:flutter/material.dart';

import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/product_badge.dart';
import 'checkout_step_card.dart';

/// Passo "2 Pagamento": o selo "Simulado" e o texto do pagamento simulado,
/// sem forma de pagamento nem campos de cartão.
class PaymentStep extends StatelessWidget {
  const PaymentStep({super.key});

  static const String title = 'Pagamento';
  static const String simulatedBadge = 'Simulado';
  static const String message =
      'Não pedimos nenhum dado de pagamento: nesta versão ele é simulado e '
      'aprovado automaticamente depois que você confirma o pedido.';

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return CheckoutStepCard(
      number: 2,
      title: title,
      badge: const ProductBadge(label: simulatedBadge),
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: tokens.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s18,
              vertical: AppSpacing.s16,
            ),
            child: Text(
              message,
              style: textTheme.bodyMedium!.copyWith(color: tokens.inkSoft),
            ),
          ),
        ),
      ],
    );
  }
}
