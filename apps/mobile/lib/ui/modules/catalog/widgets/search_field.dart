import 'package:flutter/material.dart';

import '../../../shared/theme/brand_tokens.dart';

/// Campo de busca do topo da Buscar: lupa, a dica "Buscar produtos", a
/// confirmação pelo teclado e o botão "Limpar busca", que só aparece com
/// texto. Não usa o `AppTextField`, que sempre tem rótulo visível; borda, raio
/// e altura vêm do mesmo `inputDecorationTheme`. O texto mora no [controller]
/// da página.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    required this.onSubmitted,
    required this.onClear,
  });

  static const String hint = 'Buscar produtos';
  static const String clearTooltip = 'Limpar busca';

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  /// Confirmação pelo teclado, com o texto do campo.
  final ValueChanged<String> onSubmitted;

  /// Toque em "Limpar busca"; quem esvazia o campo é a página.
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        textInputAction: TextInputAction.search,
        style: textTheme.bodyMedium!.copyWith(color: tokens.ink),
        cursorColor: tokens.brand,
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: Icon(Icons.search, color: tokens.mutedInk),
          suffixIcon: value.text.isEmpty
              ? null
              : IconButton(
                  tooltip: clearTooltip,
                  onPressed: onClear,
                  icon: Icon(Icons.close, color: tokens.mutedInk),
                ),
        ),
      ),
    );
  }
}
