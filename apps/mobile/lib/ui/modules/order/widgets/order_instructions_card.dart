import 'package:flutter/material.dart';

import '../../../shared/theme/brand_tokens.dart';
import 'checkout_step_card.dart';

/// Cartão "Instruções para o entregador", com o texto gravado no pedido. A
/// página só o mostra quando o pedido tem instruções.
class OrderInstructionsCard extends StatelessWidget {
  const OrderInstructionsCard({super.key, required this.instructions});

  static const String title = 'Instruções para o entregador';

  final String instructions;

  @override
  Widget build(BuildContext context) {
    return CheckoutStepCard(
      title: title,
      children: [
        Text(
          instructions,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium!.copyWith(color: context.tokens.inkSoft),
        ),
      ],
    );
  }
}
