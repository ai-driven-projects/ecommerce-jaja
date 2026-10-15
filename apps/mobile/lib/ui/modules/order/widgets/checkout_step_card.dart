import 'package:flutter/material.dart';

import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Cartão de um passo do checkout, do `StepTitle` de `checkout.page.tsx`: o
/// número num círculo da marca, o título e um selo opcional, com o conteúdo
/// abaixo. Sem [number], só o título (o "Resumo do pedido").
class CheckoutStepCard extends StatelessWidget {
  const CheckoutStepCard({
    super.key,
    required this.title,
    required this.children,
    this.number,
    this.badge,
  });

  /// Lado do círculo do número (`size-[30px]` do web).
  static const double numberSize = 30;

  final String title;
  final int? number;
  final Widget? badge;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

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
            Row(
              children: [
                if (number case final number?) ...[
                  ExcludeSemantics(
                    child: Container(
                      width: numberSize,
                      height: numberSize,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: tokens.brand,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$number',
                        style: textTheme.titleSmall!.copyWith(
                          color: tokens.onBrand,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s12),
                ],
                Flexible(
                  child: Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: textTheme.titleLarge!.copyWith(color: tokens.ink),
                    ),
                  ),
                ),
                if (badge case final badge?) ...[
                  const SizedBox(width: AppSpacing.s12),
                  badge,
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.s16),
            ...children,
          ],
        ),
      ),
    );
  }
}
