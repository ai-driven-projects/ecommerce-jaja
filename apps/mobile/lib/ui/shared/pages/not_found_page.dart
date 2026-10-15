import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../widgets/empty_state.dart';

/// Rota desconhecida. Recebe a volta ao início por callback, para `ui/` não
/// depender das rotas de `app/`.
class NotFoundPage extends StatelessWidget {
  const NotFoundPage({super.key, required this.onBackHome});

  final VoidCallback onBackHome;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s24),
            child: EmptyState(
              emoji: '🧭',
              title: 'Página não encontrada',
              message: 'Esse endereço não existe no app.',
              actionLabel: 'Voltar ao início',
              onAction: onBackHome,
            ),
          ),
        ),
      ),
    );
  }
}
