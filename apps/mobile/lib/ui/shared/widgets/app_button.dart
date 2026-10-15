import 'package:flutter/material.dart';

import '../theme/app_button_styles.dart';
import '../theme/brand_tokens.dart';

export '../theme/app_button_styles.dart' show AppButtonSize, AppButtonVariant;

/// Botão em pílula de `button.tsx`. Sem [onPressed] fica indisponível:
/// atenuado (opacidade 0.5, como `disabled:opacity-50`), sem a sombra da
/// marca e sem responder ao toque. Não tem spinner: o estado "enviando" é o
/// rótulo que a tela troca ("Confirmando…").
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.md,
    this.icon,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;

  /// Ícone opcional à esquerda do rótulo.
  final IconData? icon;

  /// Ocupa toda a largura disponível.
  final bool expand;

  bool get _enabled => onPressed != null;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final style = AppButtonStyles.of(
      variant: variant,
      size: size,
      tokens: tokens,
      textTheme: Theme.of(context).textTheme,
    );
    final text = Text(label, maxLines: 1, overflow: TextOverflow.ellipsis);

    Widget button = TextButton(
      style: style,
      onPressed: onPressed,
      child: icon == null
          ? text
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon),
                // `gap-2` do web.
                const SizedBox(width: 8),
                Flexible(child: text),
              ],
            ),
    );

    // `ButtonStyle` não aceita `BoxShadow`: a sombra da marca vem de fora.
    if (variant == AppButtonVariant.primary && _enabled) {
      button = DecoratedBox(
        decoration: ShapeDecoration(
          shape: const StadiumBorder(),
          shadows: tokens.shadowBrand,
        ),
        child: button,
      );
    }

    if (expand) {
      button = SizedBox(width: double.infinity, child: button);
    }

    return _enabled ? button : Opacity(opacity: 0.5, child: button);
  }
}
