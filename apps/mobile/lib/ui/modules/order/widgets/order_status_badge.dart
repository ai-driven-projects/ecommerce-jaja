import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_status.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../view_models/order_formatters.dart';

/// Selo do status do pedido, de `order-status-badge.component.tsx`: o rótulo
/// de [orderStatusLabel] no tom de `ORDER_STATUS_BADGE_VARIANT` (verde em
/// recebido, pagamento aprovado e a caminho; amarelo em separando; neutro em
/// entregue).
class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({super.key, required this.status});

  final OrderStatus status;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final (background, foreground) = switch (status) {
      OrderStatus.placed ||
      OrderStatus.paymentApproved ||
      OrderStatus.outForDelivery => (tokens.successSoft, tokens.success),
      OrderStatus.picking => (tokens.warningSoft, tokens.warning),
      OrderStatus.delivered => (tokens.surface, tokens.mutedInk),
    };

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: background,
        shape: const StadiumBorder(),
      ),
      child: Padding(
        // `px-3.5 py-1.5` do cabeçalho do acompanhamento.
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s14,
          vertical: 6,
        ),
        child: Text(
          orderStatusLabel(status),
          style: Theme.of(
            context,
          ).textTheme.labelMedium!.copyWith(color: foreground),
        ),
      ),
    );
  }
}
