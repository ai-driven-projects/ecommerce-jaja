import 'package:flutter/material.dart';

import '../theme/app_typography.dart';
import '../theme/brand_tokens.dart';

/// `md` para as categorias; `sm` para as linhas de subcategorias.
enum AppChipSize { md, sm }

/// Chip de filtro de `category-chips.component.tsx`, feito à mão (o
/// `FilterChip` impõe forma e cheque): pílula branca com borda de linha; o
/// ativo fica laranja sobre pêssego.
class AppChip extends StatelessWidget {
  const AppChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.emoji,
    this.count,
    this.size = AppChipSize.md,
    this.trailingIcon,
  });

  final String label;
  final bool selected;
  final VoidCallback? onSelected;

  /// Emoji antes do rótulo (decorativo, fora da leitura de tela).
  final String? emoji;

  /// Quantidade exibida depois do rótulo.
  final int? count;
  final AppChipSize size;

  /// Ícone depois do rótulo e da contagem (o fechar das pílulas de filtro).
  final IconData? trailingIcon;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final foreground = selected ? tokens.brand : tokens.ink;
    final labelStyle =
        (size == AppChipSize.sm ? textTheme.chipSmall : textTheme.labelMedium!)
            .copyWith(color: foreground);
    final emoji = this.emoji;
    final count = this.count;
    final trailingIcon = this.trailingIcon;

    return Semantics(
      container: true,
      button: true,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onSelected,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: selected ? tokens.brandSoft : tokens.card,
            shape: StadiumBorder(
              side: BorderSide(color: selected ? tokens.brand : tokens.line),
            ),
          ),
          child: Padding(
            // `px-[15px] py-2` (md) e `px-3 py-1.5` (sm) do web.
            padding: size == AppChipSize.sm
                ? const EdgeInsets.symmetric(horizontal: 12, vertical: 6)
                : const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (emoji != null) ...[
                  ExcludeSemantics(child: Text(emoji, style: labelStyle)),
                  const SizedBox(width: 6),
                ],
                Text(label, style: labelStyle, maxLines: 1),
                if (count != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '$count',
                    style: textTheme.chipCount.copyWith(
                      color: selected ? tokens.brand : tokens.mutedInk,
                    ),
                  ),
                ],
                if (trailingIcon != null) ...[
                  const SizedBox(width: 6),
                  Icon(trailingIcon, size: 16, color: foreground),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
