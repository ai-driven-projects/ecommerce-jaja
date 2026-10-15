import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_typography.dart';
import '../theme/brand_tokens.dart';
import 'app_button.dart';

/// Estado vazio de `empty-list-state.tsx`: emoji grande, título em display,
/// explicação curta e exatamente uma ação, num cartão branco. A borda é
/// contínua (o web usa tracejada; ver o `design.md` da etapa 2).
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
    this.emoji = defaultEmoji,
  });

  static const String defaultEmoji = '📦';

  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;
  final String emoji;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border.all(color: tokens.line),
        borderRadius: BorderRadius.circular(AppRadius.xl2),
      ),
      child: Padding(
        // `px-6 py-12` do web.
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(child: Text(emoji, style: textTheme.emptyEmoji)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.titleLarge!.copyWith(color: tokens.ink),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium!.copyWith(color: tokens.mutedInk),
            ),
            const SizedBox(height: 16),
            AppButton(
              label: actionLabel,
              onPressed: onAction,
              variant: AppButtonVariant.outline,
            ),
          ],
        ),
      ),
    );
  }
}
