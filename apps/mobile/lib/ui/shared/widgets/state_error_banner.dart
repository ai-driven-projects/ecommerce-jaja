import 'package:flutter/material.dart';

import '../../../core/errors/app_failure.dart';
import '../theme/app_radius.dart';
import '../theme/brand_tokens.dart';
import 'app_button.dart';

/// Banner de erro dos blocos que dependem de dados remotos: título, a
/// mensagem da falha e o botão "Tentar de novo", sobre o fundo de perigo.
class StateErrorBanner extends StatelessWidget {
  const StateErrorBanner({
    super.key,
    required this.failure,
    required this.onRetry,
    this.title = defaultTitle,
  });

  static const String defaultTitle = 'Não foi possível carregar.';

  final AppFailure failure;

  /// Chamada uma vez por toque em "Tentar de novo".
  final VoidCallback onRetry;
  final String title;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.dangerSoft,
        borderRadius: BorderRadius.circular(AppRadius.xl2),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: textTheme.titleSmall!.copyWith(color: tokens.ink),
            ),
            const SizedBox(height: 4),
            Text(
              failure.message,
              style: textTheme.bodyMedium!.copyWith(color: tokens.inkSoft),
            ),
            const SizedBox(height: 12),
            AppButton(
              label: 'Tentar de novo',
              onPressed: onRetry,
              variant: AppButtonVariant.outline,
              size: AppButtonSize.sm,
            ),
          ],
        ),
      ),
    );
  }
}
