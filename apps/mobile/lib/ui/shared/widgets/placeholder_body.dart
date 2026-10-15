import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/brand_tokens.dart';

/// Corpo das páginas provisórias das abas: o nome da aba e um aviso de que a
/// tela ainda vem. Cada etapa troca a sua página pela de verdade.
class PlaceholderBody extends StatelessWidget {
  const PlaceholderBody({super.key, required this.title});

  static const String comingSoon = 'Em breve por aqui.';

  final String title;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.headlineSmall!.copyWith(color: tokens.ink),
            ),
            const SizedBox(height: AppSpacing.s8),
            Text(
              comingSoon,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium!.copyWith(color: tokens.mutedInk),
            ),
          ],
        ),
      ),
    );
  }
}
