import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_progress.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Um passo da linha do tempo, do `TimelineStep` de
/// `order-tracking.component.tsx`: concluído (círculo verde com ✓), atual
/// (borda da marca com o ponto) ou pendente (borda neutra e título
/// atenuado), com a linha até o passo seguinte quando não é o último.
///
/// Com [highlight], o fundo vai de `successSoft` a transparente uma vez, ao
/// montar (`animate-step-done` do web); com as animações desligadas no
/// aparelho, nada é desenhado.
class OrderTimelineStep extends StatelessWidget {
  const OrderTimelineStep({
    super.key,
    required this.title,
    required this.detail,
    required this.state,
    required this.isLast,
    this.highlight = false,
  });

  /// `--animate-step-done: step-done 1.6s ease-out` do `globals.css`.
  static const Duration highlightDuration = Duration(milliseconds: 1600);

  /// Fundo do destaque, para os testes o acharem.
  static const Key highlightKey = ValueKey('order-timeline-step-highlight');

  /// Lado do círculo (`size-[26px]` do web), também a altura mínima da linha.
  static const double markerSize = 26;

  static String doneSemantics(String title) => 'Concluído: $title';

  final String title;

  /// A hora do passo concluído, "Em andamento…" ou "Aguardando".
  final String detail;
  final OrderStepState state;
  final bool isLast;

  /// Passo concluído com a tela aberta.
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final content = _content(context);
    if (!highlight || MediaQuery.disableAnimationsOf(context)) return content;

    final soft = context.tokens.successSoft;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 1, end: 0),
      duration: highlightDuration,
      curve: Curves.easeOut,
      child: content,
      builder: (context, opacity, child) => DecoratedBox(
        key: highlightKey,
        decoration: BoxDecoration(
          color: soft.withValues(alpha: soft.a * opacity),
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
        child: child,
      ),
    );
  }

  Widget _content(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final done = state == OrderStepState.done;
    final current = state == OrderStepState.current;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ExcludeSemantics(
            child: Column(
              children: [
                _Marker(state: state),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      constraints: const BoxConstraints(minHeight: markerSize),
                      color: done ? tokens.success : tokens.line,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s14),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    semanticsLabel: done ? doneSemantics(title) : null,
                    style: textTheme.titleSmall!.copyWith(
                      color: state == OrderStepState.pending
                          ? tokens.placeholder
                          : tokens.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail,
                    style: current
                        ? textTheme.labelMedium!.copyWith(color: tokens.brand)
                        : textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Círculo do passo, conforme [state].
class _Marker extends StatelessWidget {
  const _Marker({required this.state});

  final OrderStepState state;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final (border, fill) = switch (state) {
      OrderStepState.done => (tokens.success, tokens.success),
      OrderStepState.current => (tokens.brand, tokens.brandSoft),
      OrderStepState.pending => (tokens.line, tokens.card),
    };

    return Container(
      width: OrderTimelineStep.markerSize,
      height: OrderTimelineStep.markerSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: fill,
        shape: BoxShape.circle,
        border: Border.all(color: border, width: 2),
      ),
      child: switch (state) {
        OrderStepState.done => Text(
          '✓',
          style: Theme.of(
            context,
          ).textTheme.labelSmall!.copyWith(color: tokens.onBrand),
        ),
        OrderStepState.current => Container(
          width: AppSpacing.s8,
          height: AppSpacing.s8,
          decoration: BoxDecoration(
            color: tokens.brand,
            shape: BoxShape.circle,
          ),
        ),
        OrderStepState.pending => null,
      },
    );
  }
}
