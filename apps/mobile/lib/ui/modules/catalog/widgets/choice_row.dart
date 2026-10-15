import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Linha de escolha única dos painéis da Buscar (ordem e categoria), no molde
/// das linhas do seletor de loja: a escolhida fica em laranja, com o cheque,
/// e é anunciada como selecionada. Sem `Radio`, cuja API de grupo mudou nas
/// versões recentes do Flutter.
class ChoiceRow extends StatelessWidget {
  const ChoiceRow({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.caption,
    this.indent = 0,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// Texto menor abaixo do rótulo (a contagem de produtos da categoria).
  final String? caption;

  /// Recuo à esquerda, além da margem da linha.
  final double indent;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final caption = this.caption;

    return ListTile(
      onTap: onTap,
      selected: selected,
      dense: true,
      contentPadding: EdgeInsets.only(
        left: AppSpacing.s16 + indent,
        right: AppSpacing.s16,
      ),
      title: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: textTheme.labelLarge!.copyWith(
          color: selected ? tokens.brand : tokens.ink,
        ),
      ),
      subtitle: caption == null
          ? null
          : Text(
              caption,
              style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
            ),
      trailing: selected ? Icon(Icons.check, color: tokens.brand) : null,
    );
  }
}
