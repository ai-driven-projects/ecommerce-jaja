import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';

/// "Sobre o produto", de `ProductDescription` em
/// `product-detail.component.tsx`: o texto com as quebras de linha da API
/// (`whitespace-pre-line`). Acima de [collapseLength] caracteres começa
/// recolhido em [collapsedLines] linhas, com "Ler mais"/"Ler menos". Sem
/// descrição, quem a usa não a monta.
class ProductDescription extends StatefulWidget {
  const ProductDescription({super.key, required this.description});

  static const String title = 'Sobre o produto';
  static const String readMoreLabel = 'Ler mais';
  static const String readLessLabel = 'Ler menos';

  /// Descrição maior que isto começa recolhida (`COLLAPSE_LENGTH` do web).
  static const int collapseLength = 600;

  /// Linhas visíveis recolhida (`line-clamp-8`).
  static const int collapsedLines = 8;

  final String description;

  @override
  State<ProductDescription> createState() => _ProductDescriptionState();
}

class _ProductDescriptionState extends State<ProductDescription> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final collapsible =
        widget.description.length > ProductDescription.collapseLength;
    final collapsed = collapsible && !_expanded;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(
            ProductDescription.title,
            style: textTheme.sectionSmall.copyWith(color: tokens.ink),
          ),
        ),
        const SizedBox(height: AppSpacing.s8),
        Text(
          widget.description,
          maxLines: collapsed ? ProductDescription.collapsedLines : null,
          overflow: collapsed ? TextOverflow.ellipsis : null,
          style: textTheme.descriptionBody.copyWith(color: tokens.inkSoft),
        ),
        if (collapsible)
          Semantics(
            expanded: _expanded,
            child: TextButton(
              onPressed: () => setState(() => _expanded = !_expanded),
              child: Text(
                _expanded
                    ? ProductDescription.readLessLabel
                    : ProductDescription.readMoreLabel,
              ),
            ),
          ),
      ],
    );
  }
}
