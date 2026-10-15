import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_entity.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../view_models/order_formatters.dart';
import 'order_status_badge.dart';

/// Cabeçalho do acompanhamento, de `order-tracking.component.tsx`: "Pedido
/// #`<número>`" com o selo do status, "Feito hoje às…" (ou a data), o
/// endereço copiado no pedido em uma linha e "Quem recebe". As datas do
/// pedido (UTC) são mostradas no fuso do aparelho; [now] é o relógio do
/// ViewModel.
class OrderHeader extends StatelessWidget {
  const OrderHeader({super.key, required this.order, required this.now});

  static String title(String number) => 'Pedido #$number';

  static String recipientLabel(String name) => 'Quem recebe: $name';

  final OrderDetail order;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          spacing: AppSpacing.s12,
          runSpacing: AppSpacing.s8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Semantics(
              header: true,
              child: Text(
                title(order.number),
                style: textTheme.productTitle.copyWith(color: tokens.ink),
              ),
            ),
            OrderStatusBadge(status: order.status),
          ],
        ),
        const SizedBox(height: AppSpacing.s4),
        Text(
          formatOrderPlacedAt(order.placedAt.toLocal(), now.toLocal()),
          style: textTheme.bodyMedium!.copyWith(color: tokens.mutedInk),
        ),
        const SizedBox(height: AppSpacing.s10),
        _InfoLine(
          icon: Icons.place_outlined,
          text: formatOrderAddress(order.deliveryAddress),
          style: textTheme.titleSmall!.copyWith(color: tokens.ink),
        ),
        const SizedBox(height: AppSpacing.s4),
        _InfoLine(
          icon: Icons.person_outline,
          text: recipientLabel(order.recipientName),
          style: textTheme.bodyMedium!.copyWith(color: tokens.inkSoft),
        ),
      ],
    );
  }
}

/// Linha do cabeçalho com o ícone decorativo à esquerda.
class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.icon,
    required this.text,
    required this.style,
  });

  final IconData icon;
  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: ExcludeSemantics(
            child: Icon(icon, size: 16, color: context.tokens.mutedInk),
          ),
        ),
        const SizedBox(width: AppSpacing.s8),
        Expanded(child: Text(text, style: style)),
      ],
    );
  }
}
