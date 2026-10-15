import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_status.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/skeleton_box.dart';
import 'checkout_line_tile.dart';
import 'order_timeline_step.dart';

/// Blocos estáticos do cabeçalho, dos cinco passos e de duas linhas de itens
/// (o `TrackingSkeleton` do web), anunciados uma vez como "Carregando".
class OrderTrackingSkeleton extends StatelessWidget {
  const OrderTrackingSkeleton({super.key});

  static const int itemCount = 2;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: 0.7,
            child: SkeletonBox(height: 32, radius: AppRadius.sm),
          ),
          const SizedBox(height: AppSpacing.s10),
          const FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: 0.45,
            child: SkeletonBox(height: 16, radius: AppRadius.sm),
          ),
          const SizedBox(height: AppSpacing.s8),
          const SkeletonBox(height: 16, radius: AppRadius.sm),
          const SizedBox(height: AppSpacing.s24),
          _SkeletonCard(
            children: [
              for (final _ in OrderStatus.values)
                const Padding(
                  padding: EdgeInsets.only(bottom: AppSpacing.s20),
                  child: Row(
                    children: [
                      SkeletonBox(
                        width: OrderTimelineStep.markerSize,
                        height: OrderTimelineStep.markerSize,
                        radius: AppRadius.pill,
                      ),
                      SizedBox(width: AppSpacing.s14),
                      Expanded(
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: 0.5,
                          child: SkeletonBox(height: 16, radius: AppRadius.sm),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.s16),
          _SkeletonCard(
            children: [
              for (var index = 0; index < itemCount; index++)
                const Padding(
                  padding: EdgeInsets.only(bottom: AppSpacing.s12),
                  child: Row(
                    children: [
                      SkeletonBox(
                        width: CheckoutLineTile.artSize,
                        height: CheckoutLineTile.artSize,
                        radius: AppRadius.lg,
                      ),
                      SizedBox(width: AppSpacing.s12),
                      Expanded(
                        child: SkeletonBox(height: 16, radius: AppRadius.sm),
                      ),
                      SizedBox(width: AppSpacing.s12),
                      SkeletonBox(width: 56, height: 16, radius: AppRadius.sm),
                    ],
                  ),
                ),
              const SkeletonBox(height: 80, radius: AppRadius.xl),
            ],
          ),
        ],
      ),
    );
  }
}

/// Moldura do cartão (a mesma do `CheckoutStepCard`), com uma barra no lugar
/// do título.
class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border.all(color: tokens.line),
        borderRadius: BorderRadius.circular(AppRadius.xl4),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: 0.4,
              child: SkeletonBox(height: 20, radius: AppRadius.sm),
            ),
            const SizedBox(height: AppSpacing.s20),
            ...children,
          ],
        ),
      ),
    );
  }
}
