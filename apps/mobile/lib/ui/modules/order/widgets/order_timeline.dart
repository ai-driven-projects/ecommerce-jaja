import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_entity.dart';
import '../../../../modules/order/model/order_progress.dart';
import '../../../../modules/order/model/order_status.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../view_models/order_formatters.dart';
import 'checkout_step_card.dart';
import 'order_timeline_step.dart';

/// Cartão "Status do pedido", de `order-tracking.component.tsx`: os cinco
/// passos na ordem de [OrderStatus], com a hora `HH:MM:SS` (no fuso do
/// aparelho) de cada passo concluído, "Em andamento…" no atual e
/// "Aguardando" nos pendentes, e o aviso de entregue no fim.
class OrderTimeline extends StatelessWidget {
  const OrderTimeline({super.key, required this.order});

  static const String title = 'Status do pedido';
  static const String currentDetail = 'Em andamento…';
  static const String pendingDetail = 'Aguardando';

  /// No lugar de uma hora que a API não mandou.
  static const String missingTime = '…';

  static String deliveredMessage(String time) =>
      'Pedido entregue às $time. Obrigado por comprar no já já!';

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final steps = OrderStatus.values;
    final deliveredAt = order.deliveredAt;

    return CheckoutStepCard(
      title: title,
      children: [
        for (final (index, step) in steps.indexed)
          OrderTimelineStep(
            key: ValueKey(step),
            title: orderStatusLabel(step),
            detail: _detailOf(step),
            state: orderStepState(order.status, step),
            isLast: index == steps.length - 1,
          ),
        if (isOrderFinished(order.status))
          Semantics(
            liveRegion: true,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: tokens.successSoft,
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.s14,
                  vertical: AppSpacing.s10,
                ),
                child: Text(
                  deliveredMessage(
                    deliveredAt == null
                        ? missingTime
                        : formatOrderTime(deliveredAt.toLocal()),
                  ),
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall!.copyWith(color: tokens.successStrong),
                ),
              ),
            ),
          ),
      ],
    );
  }

  String _detailOf(OrderStatus step) {
    switch (orderStepState(order.status, step)) {
      case OrderStepState.done:
        final date = order.dateOf(step);
        return date == null
            ? missingTime
            : formatOrderTimeWithSeconds(date.toLocal());
      case OrderStepState.current:
        return currentDetail;
      case OrderStepState.pending:
        return pendingDetail;
    }
  }
}
