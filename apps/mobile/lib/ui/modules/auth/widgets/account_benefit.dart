import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Uma vantagem do convite: "✓" num círculo de sucesso e o texto.
class AccountBenefit extends StatelessWidget {
  const AccountBenefit({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    return Row(
      children: [
        Container(
          width: AppSpacing.s24,
          height: AppSpacing.s24,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: tokens.successSoft,
            shape: BoxShape.circle,
          ),
          child: Text(
            '✓',
            style: textTheme.labelMedium!.copyWith(color: tokens.success),
          ),
        ),
        const SizedBox(width: AppSpacing.s12),
        Expanded(
          child: Text(
            label,
            style: textTheme.bodyMedium!.copyWith(color: tokens.ink),
          ),
        ),
      ],
    );
  }
}
