import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_entity.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/product_art.dart';
import '../../cart/view_models/cart_texts.dart';
import '../../catalog/view_models/category_art.dart';
import 'checkout_line_tile.dart';
import 'checkout_step_card.dart';

/// Cartão "Itens do pedido", de `order-tracking.component.tsx`: as linhas na
/// ordem recebida (foto ou a arte de reserva, nome, "× n" e o total da
/// linha) e os totais gravados no pedido, sem recalcular: "Subtotal",
/// "Entrega de bike" (ou "Grátis") e "Total" com "Pagamento simulado".
class OrderItemsCard extends StatelessWidget {
  const OrderItemsCard({super.key, required this.order});

  static const String title = 'Itens do pedido';
  static const String subtotalLabel = 'Subtotal';
  static const String deliveryLabel = CartTexts.bikeDeliveryLabel;
  static const String freeLabel = 'Grátis';
  static const String totalLabel = 'Total';
  static const String paymentNote = 'Pagamento simulado';

  final OrderDetail order;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final labelStyle = textTheme.bodyMedium!.copyWith(color: tokens.mutedInk);
    final valueStyle = textTheme.titleSmall!.copyWith(
      color: tokens.ink,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    final totalStyle = textTheme.titleMedium!.copyWith(
      color: tokens.ink,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    return CheckoutStepCard(
      title: title,
      children: [
        for (final item in order.items) ...[
          _OrderItemRow(key: ValueKey(item.productId), item: item),
          const SizedBox(height: AppSpacing.s12),
        ],
        Divider(height: AppSpacing.s12, color: tokens.line),
        const SizedBox(height: AppSpacing.s8),
        _row(
          Text(subtotalLabel, style: labelStyle),
          Text(formatMoney(order.subtotal), style: valueStyle),
        ),
        const SizedBox(height: AppSpacing.s8),
        _row(
          Text(deliveryLabel, style: labelStyle),
          order.deliveryFee.cents == 0
              ? Text(
                  freeLabel,
                  style: textTheme.titleSmall!.copyWith(color: tokens.success),
                )
              : Text(formatMoney(order.deliveryFee), style: valueStyle),
        ),
        const SizedBox(height: AppSpacing.s12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(totalLabel, style: totalStyle),
                  Text(
                    paymentNote,
                    style: textTheme.bodySmall!.copyWith(
                      color: tokens.mutedInk,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.s12),
            Text(formatMoney(order.total), style: totalStyle),
          ],
        ),
      ],
    );
  }

  Widget _row(Widget label, Widget value) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [label, value],
  );
}

/// Linha de um item, no molde da [CheckoutLineTile]. O item do pedido não tem
/// categoria: sem foto, aparece a arte de reserva.
class _OrderItemRow extends StatelessWidget {
  const _OrderItemRow({super.key, required this.item});

  final OrderItem item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final art = categoryArtOf('');

    return Row(
      children: [
        SizedBox.square(
          dimension: CheckoutLineTile.artSize,
          child: ProductArt(
            imageUrl: item.thumbUrl,
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
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: textTheme.titleSmall!.copyWith(color: tokens.ink),
              ),
              Text(
                CheckoutLineTile.quantityLabel(item.quantity),
                style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.s12),
        Text(
          formatMoney(item.lineTotal),
          style: textTheme.titleSmall!.copyWith(
            color: tokens.ink,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}
