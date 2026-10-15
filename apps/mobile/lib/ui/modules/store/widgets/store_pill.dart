import 'package:flutter/material.dart';

import '../../../../modules/store/model/store_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Pílula da loja em vigor de `store-picker.component.tsx`: ícone de loja
/// laranja, o nome em destaque e, quando conhecida, " · Cidade/UF". Com
/// [onTap] ganha o chevron e vira botão; sem ele fica estática (uma loja só).
class StorePill extends StatelessWidget {
  const StorePill({super.key, required this.store, this.onTap});

  /// Altura fixa, para o skeleton e a pílula com ou sem cidade ocuparem a
  /// mesma caixa (`py-[9px]` do web em volta da linha do `bodyMedium`).
  static const double height = 40;

  static const double _iconSize = 18;

  final Store store;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final place = store.place;
    final onTap = this.onTap;
    final placeStyle = textTheme.bodyMedium!.copyWith(color: tokens.mutedInk);

    final pill = SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: tokens.surface,
          border: Border.all(color: tokens.line),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.storefront_outlined,
                size: _iconSize,
                color: tokens.brand,
              ),
              const SizedBox(width: AppSpacing.s8),
              Flexible(
                child: Text(
                  store.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelLarge!.copyWith(color: tokens.brand),
                ),
              ),
              if (place != null) ...[
                ExcludeSemantics(child: Text(' · ', style: placeStyle)),
                Flexible(
                  child: Text(
                    place.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: placeStyle,
                  ),
                ),
              ],
              if (onTap != null) ...[
                const SizedBox(width: AppSpacing.s4),
                Icon(
                  Icons.expand_more,
                  size: _iconSize,
                  color: tokens.mutedInk,
                ),
              ],
            ],
          ),
        ),
      ),
    );

    if (onTap == null) return pill;

    // O mesmo `aria-label` do web: a leitura de tela ouve a loja e a ação.
    return Semantics(
      container: true,
      button: true,
      excludeSemantics: true,
      label: 'Loja escolhida: ${store.name}. Trocar de loja',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: pill,
      ),
    );
  }
}
