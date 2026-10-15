import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Trilha de categorias do detalhe, da raiz até a do produto, separadas por
/// "/". Cada uma é um [CatalogLink]; tocar chama [onOpenCategory] com o slug
/// (a página abre a Buscar filtrada). Sem "Início": a aba já está na barra.
class CategoryTrail extends StatelessWidget {
  const CategoryTrail({
    super.key,
    required this.categories,
    required this.onOpenCategory,
  });

  final List<CatalogRef> categories;
  final ValueChanged<String> onOpenCategory;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final (index, category) in categories.indexed) ...[
          if (index > 0)
            ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
                child: Text(
                  '/',
                  style: textTheme.titleSmall!.copyWith(color: tokens.mutedInk),
                ),
              ),
            ),
          CatalogLink(
            label: category.name,
            onTap: () => onOpenCategory(category.slug),
          ),
        ],
      ],
    );
  }
}

/// Link do catálogo no detalhe (categoria da trilha, marca acima do nome):
/// texto laranja com alvo de toque mínimo de 44.
class CatalogLink extends StatelessWidget {
  const CatalogLink({super.key, required this.label, required this.onTap});

  /// Alvo de toque mínimo (altura).
  static const double minTapHeight = 44;

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      container: true,
      link: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: minTapHeight),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
            child: Align(
              alignment: Alignment.centerLeft,
              widthFactor: 1,
              heightFactor: 1,
              child: Text(
                label,
                style: textTheme.titleSmall!.copyWith(color: tokens.brand),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
