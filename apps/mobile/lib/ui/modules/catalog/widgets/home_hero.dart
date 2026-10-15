import 'package:flutter/material.dart';

import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Bloco escuro de abertura da Início, de `storefront-hero.component.tsx`
/// reduzido ao que é da marca: a pílula com a loja em vigor, o título e o
/// parágrafo. Sem botão, contagem de entregadores nem "pedidos ao vivo" (são
/// mock no web, e a tela tem uma ação principal só).
class HomeHero extends StatelessWidget {
  const HomeHero({super.key, required this.storeName});

  static const String pillWithoutStore = 'De bike e a pé até você';
  static const String titleStart = 'Acabou no escritório?\nChega ';
  static const String titleAccent = 'em minutos.';
  static const String paragraph =
      'Papel, toner, café e tudo que o seu escritório consome — entregue por '
      'bike direto na sua recepção, sem taxa surpresa.';

  static String pillWithStore(String storeName) =>
      'De bike e a pé, saindo da $storeName';

  /// Nome da loja em vigor; `null` enquanto as lojas carregam ou sem loja.
  final String? storeName;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final storeName = this.storeName;
    final titleStyle = textTheme.displaySmall!.copyWith(color: tokens.onBrand);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.dark,
        borderRadius: BorderRadius.circular(AppRadius.xl4),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _Pill(
              text: storeName == null
                  ? pillWithoutStore
                  : pillWithStore(storeName),
            ),
            const SizedBox(height: AppSpacing.s16),
            Text.rich(
              TextSpan(
                text: titleStart,
                children: [
                  TextSpan(
                    text: titleAccent,
                    style: titleStyle.copyWith(color: tokens.brandLight),
                  ),
                ],
              ),
              style: titleStyle,
            ),
            const SizedBox(height: AppSpacing.s12),
            Text(
              paragraph,
              style: textTheme.bodyLarge!.copyWith(color: tokens.darkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pílula translúcida sobre o bloco escuro (`border-white/20 bg-white/10`).
class _Pill extends StatelessWidget {
  const _Pill({required this.text});

  static const double _iconSize = 15;

  final String text;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: tokens.darkSurface,
        shape: StadiumBorder(side: BorderSide(color: tokens.darkLine)),
      ),
      child: Padding(
        // `px-3.5 py-1.5` do web.
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s14,
          vertical: 6,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.pedal_bike, size: _iconSize, color: tokens.brandPale),
            const SizedBox(width: AppSpacing.s8),
            Flexible(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.chipSmall.copyWith(color: tokens.brandPale),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
