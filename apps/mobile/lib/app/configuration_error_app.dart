import 'package:flutter/material.dart';

import '../core/errors/app_failure.dart';
import '../ui/shared/theme/app_spacing.dart';
import '../ui/shared/theme/app_theme.dart';
import '../ui/shared/theme/brand_tokens.dart';

/// Aberto no lugar do app quando o endereço da API não pôde ser resolvido
/// (ex.: produção sem `API_URL`). Só estilos do tema, como as páginas.
class ConfigurationErrorApp extends StatelessWidget {
  const ConfigurationErrorApp({super.key, required this.failure});

  final AppFailure failure;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Jajá',
      theme: AppTheme.light(),
      themeMode: ThemeMode.light,
      debugShowCheckedModeBanner: false,
      home: _ConfigurationErrorScreen(failure: failure),
    );
  }
}

class _ConfigurationErrorScreen extends StatelessWidget {
  const _ConfigurationErrorScreen({required this.failure});

  final AppFailure failure;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Não foi possível iniciar o app.',
                  style: textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.s8),
                Text(
                  failure.message,
                  style: textTheme.bodyMedium?.copyWith(
                    color: context.tokens.mutedInk,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
