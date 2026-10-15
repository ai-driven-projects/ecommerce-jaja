import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Título de seção da vitrine, de `section-heading.component.tsx`: título em
/// display e, com [onSeeAll], a ação "Ver tudo →" laranja à direita.
class SectionHeading extends StatelessWidget {
  const SectionHeading({super.key, required this.title, this.onSeeAll});

  static const String seeAllLabel = 'Ver tudo →';

  final String title;

  /// Abre a listagem inteira da seção; sem ele, a ação não aparece.
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final onSeeAll = this.onSeeAll;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Expanded(
          child: Text(
            title,
            style: textTheme.headlineSmall!.copyWith(color: tokens.ink),
          ),
        ),
        if (onSeeAll != null) ...[
          const SizedBox(width: AppSpacing.s12),
          Semantics(
            container: true,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onSeeAll,
              child: Text(
                seeAllLabel,
                style: textTheme.titleSmall!.copyWith(color: tokens.brand),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
