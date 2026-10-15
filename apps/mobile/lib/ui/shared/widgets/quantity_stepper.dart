import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/brand_tokens.dart';

/// Tamanhos do controle: [compact] é o `sm` de `quantity-stepper.component.tsx`
/// (linha do carrinho, sobre `brand-soft`); [large] é o `lg` (rodapé do
/// produto, sobre `surface`).
enum QuantityStepperSize { compact, large }

/// Controle "− n +" em pílula, de `quantity-stepper.component.tsx`: o "−"
/// branco e o "+" laranja. Sem [onDecrement] ou [onIncrement], o botão fica
/// indisponível (atenuado, sem responder ao toque); quem usa decide os
/// limites. Cada botão tem alvo de toque de pelo menos 44 e o rótulo do web
/// (`Diminuir quantidade de <nome>`).
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.itemName,
    required this.onDecrement,
    required this.onIncrement,
    this.size = QuantityStepperSize.compact,
  });

  /// Alvo de toque mínimo de cada botão.
  static const double minTapTarget = 44;

  static String decrementLabel(String itemName) =>
      'Diminuir quantidade de $itemName';

  static String incrementLabel(String itemName) =>
      'Aumentar quantidade de $itemName';

  final int quantity;
  final String itemName;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;
  final QuantityStepperSize size;

  bool get _large => size == QuantityStepperSize.large;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final valueStyle = (_large ? textTheme.titleLarge! : textTheme.titleSmall!)
        .copyWith(
          color: _large ? tokens.ink : tokens.brand,
          fontFeatures: const [FontFeature.tabularFigures()],
        );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: _large ? tokens.surface : tokens.brandSoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: tokens.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepButton(
            label: decrementLabel(itemName),
            icon: Icons.remove,
            onPressed: onDecrement,
            background: tokens.card,
            foreground: tokens.brand,
            diameter: _large ? 38 : 28,
          ),
          ConstrainedBox(
            constraints: BoxConstraints(minWidth: _large ? 36 : 20),
            child: Semantics(
              liveRegion: true,
              child: Text(
                '$quantity',
                textAlign: TextAlign.center,
                style: valueStyle,
              ),
            ),
          ),
          _StepButton(
            label: incrementLabel(itemName),
            icon: Icons.add,
            onPressed: onIncrement,
            background: tokens.brand,
            foreground: tokens.onBrand,
            diameter: _large ? 38 : 28,
          ),
        ],
      ),
    );
  }
}

/// Botão redondo do controle, centrado num alvo de toque de 44.
class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    required this.background,
    required this.foreground,
    required this.diameter,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final Color background;
  final Color foreground;
  final double diameter;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;

    return MergeSemantics(
      child: Semantics(
        button: true,
        enabled: enabled,
        label: label,
        child: InkResponse(
          onTap: onPressed,
          radius: QuantityStepper.minTapTarget / 2,
          child: SizedBox.square(
            dimension: QuantityStepper.minTapTarget,
            child: Center(
              child: Opacity(
                // `disabled:opacity-40` do web.
                opacity: enabled ? 1 : 0.4,
                child: SizedBox.square(
                  dimension: diameter,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: background,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: diameter / 2, color: foreground),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
