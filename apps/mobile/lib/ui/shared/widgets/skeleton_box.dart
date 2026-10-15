import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/brand_tokens.dart';

/// Bloco de carregamento estático na cor `surface`, no tamanho e no raio do
/// conteúdo que substitui. Não anima (sem brilho, pulsação nem indicador
/// giratório) e é anunciado como "Carregando".
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height,
    this.radius = AppRadius.xl,
  });

  final double? width;
  final double? height;

  /// Um dos raios de `AppRadius`, o mesmo do conteúdo substituído.
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Carregando',
      child: SizedBox(
        width: width,
        height: height,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: context.tokens.surface,
            borderRadius: BorderRadius.circular(radius),
          ),
        ),
      ),
    );
  }
}
