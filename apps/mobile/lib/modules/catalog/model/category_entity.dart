import 'package:freezed_annotation/freezed_annotation.dart';

part 'category_entity.freezed.dart';

/// Nó da árvore de categorias da vitrine, com os campos de
/// `StorefrontCategoryDTO`: só categorias com produtos visíveis, na ordem da
/// API. [level] é 1 na raiz, [parentSlug] é `null` na raiz e [productCount]
/// soma os produtos da categoria e das descendentes.
@freezed
abstract class Category with _$Category {
  const factory Category({
    required String slug,
    required String name,
    required int level,
    required String? parentSlug,
    required bool isHighlighted,
    required int productCount,
    required List<Category> children,
  }) = _Category;
}
