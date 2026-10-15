import '../../modules/catalog/model/category_entity.dart';

/// Nó da árvore como `GET /storefront/categories` o devolve:
/// `StorefrontCategoryDTO` em
/// `modules/catalog/src/category/dto/storefront-category.dto.ts`, escrito à
/// mão e recursivo em [children].
///
/// Os casts são estritos, como no DTO de loja: campo ausente ou de outro tipo
/// lança `TypeError`, que o `runRequest` converte em falha inesperada.
/// `parentSlug` ausente ou `null` vale como raiz. Campos a mais são ignorados.
final class StorefrontCategoryDto {
  const StorefrontCategoryDto({
    required this.slug,
    required this.name,
    required this.level,
    required this.parentSlug,
    required this.isHighlighted,
    required this.productCount,
    required this.children,
  });

  factory StorefrontCategoryDto.fromJson(Map<String, Object?> json) {
    final children = json['children'] as List<Object?>;
    return StorefrontCategoryDto(
      slug: json['slug'] as String,
      name: json['name'] as String,
      level: json['level'] as int,
      parentSlug: json['parentSlug'] as String?,
      isHighlighted: json['isHighlighted'] as bool,
      productCount: json['productCount'] as int,
      children: List.unmodifiable(
        children.map(
          (child) =>
              StorefrontCategoryDto.fromJson(child as Map<String, Object?>),
        ),
      ),
    );
  }

  final String slug;
  final String name;
  final int level;
  final String? parentSlug;
  final bool isHighlighted;
  final int productCount;
  final List<StorefrontCategoryDto> children;

  Category toEntity() {
    return Category(
      slug: slug,
      name: name,
      level: level,
      parentSlug: parentSlug,
      isHighlighted: isHighlighted,
      productCount: productCount,
      children: List.unmodifiable(children.map((child) => child.toEntity())),
    );
  }
}

/// Converte o corpo de `GET /storefront/categories` (lista de raízes, na
/// ordem da API) na árvore de entidades. Qualquer outra forma de corpo lança,
/// e o `runRequest` transforma isso em falha inesperada.
List<Category> parseStorefrontCategories(Object? data) {
  final items = data as List<Object?>;
  return List.unmodifiable(
    items.map(
      (item) => StorefrontCategoryDto.fromJson(
        item as Map<String, Object?>,
      ).toEntity(),
    ),
  );
}
