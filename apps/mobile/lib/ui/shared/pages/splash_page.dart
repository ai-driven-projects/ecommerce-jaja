import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/brand_tokens.dart';

/// Abertura enquanto a sessão guardada é conferida: a marca e um indicador de
/// carregamento, sem a barra de abas. Sem ViewModel: a guarda do router troca
/// a rota quando a sessão é conhecida.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  static const String brandName = 'Jajá';
  static const String loadingLabel = 'Carregando';

  @override
  Widget build(BuildContext context) {
    final brand = context.tokens.brand;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              brandName,
              style: Theme.of(
                context,
              ).textTheme.displaySmall?.copyWith(color: brand),
            ),
            const SizedBox(height: AppSpacing.s24),
            Semantics(
              label: loadingLabel,
              child: CircularProgressIndicator(color: brand),
            ),
          ],
        ),
      ),
    );
  }
}
