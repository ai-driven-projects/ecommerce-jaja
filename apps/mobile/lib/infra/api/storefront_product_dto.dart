import '../../core/result.dart';
import '../../core/value_objects/money.dart';
import '../../modules/catalog/model/product_page_entity.dart';
import '../../modules/catalog/model/product_summary_entity.dart';

/// Card da listagem como `GET /storefront/products` o devolve:
/// `StorefrontProductListItemDTO` em
/// `modules/catalog/src/product/dto/storefront-product.dto.ts`, escrito à
/// mão.
///
/// Os casts são estritos, como no DTO de loja: campo ausente ou de outro tipo
/// lança `TypeError`. Os preços passam por [Money.fromCents]: centavos
/// negativos lançam `FormatException`. Nos dois casos o `runRequest` converte
/// em falha inesperada. Campos a mais são ignorados.
final class StorefrontProductListItemDto {
  const StorefrontProductListItemDto({
    required this.id,
    required this.slug,
    required this.name,
    required this.brandName,
    required this.categoryName,
    required this.rootCategorySlug,
    required this.priceCents,
    required this.listPriceCents,
    required this.discountPercent,
    required this.unit,
    required this.thumbUrl,
    required this.isFeatured,
  });

  factory StorefrontProductListItemDto.fromJson(Map<String, Object?> json) {
    return StorefrontProductListItemDto(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      brandName: json['brandName'] as String?,
      categoryName: json['categoryName'] as String,
      rootCategorySlug: json['rootCategorySlug'] as String,
      priceCents: json['priceCents'] as int,
      listPriceCents: json['listPriceCents'] as int?,
      discountPercent: json['discountPercent'] as int?,
      unit: json['unit'] as String,
      thumbUrl: json['thumbUrl'] as String?,
      isFeatured: json['isFeatured'] as bool,
    );
  }

  final String id;
  final String slug;
  final String name;
  final String? brandName;
  final String categoryName;
  final String rootCategorySlug;
  final int priceCents;
  final int? listPriceCents;
  final int? discountPercent;
  final String unit;
  final String? thumbUrl;
  final bool isFeatured;

  ProductSummary toEntity() {
    final listPriceCents = this.listPriceCents;
    return ProductSummary(
      id: id,
      slug: slug,
      name: name,
      brandName: brandName,
      categoryName: categoryName,
      rootCategorySlug: rootCategorySlug,
      price: _money(priceCents, 'priceCents'),
      listPrice: listPriceCents == null
          ? null
          : _money(listPriceCents, 'listPriceCents'),
      discountPercent: discountPercent,
      unit: unit,
      thumbUrl: thumbUrl,
      isFeatured: isFeatured,
    );
  }

  Money _money(int cents, String field) {
    return switch (Money.fromCents(cents)) {
      Ok(:final value) => value,
      Failure(:final failure) => throw FormatException(
        '$field fora do formato ($cents): ${failure.message}',
      ),
    };
  }
}

/// Marca do resultado (`StorefrontBrandFacetDTO`).
final class StorefrontBrandFacetDto {
  const StorefrontBrandFacetDto({
    required this.slug,
    required this.name,
    required this.count,
  });

  factory StorefrontBrandFacetDto.fromJson(Map<String, Object?> json) {
    return StorefrontBrandFacetDto(
      slug: json['slug'] as String,
      name: json['name'] as String,
      count: json['count'] as int,
    );
  }

  final String slug;
  final String name;
  final int count;

  BrandFacet toEntity() => BrandFacet(slug: slug, name: name, count: count);
}

/// Uma página de `GET /storefront/products` (`StorefrontProductPageDTO`).
final class StorefrontProductPageDto {
  const StorefrontProductPageDto({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
    required this.brandFacets,
  });

  factory StorefrontProductPageDto.fromJson(Map<String, Object?> json) {
    final items = json['items'] as List<Object?>;
    final facets = json['brandFacets'] as List<Object?>;
    return StorefrontProductPageDto(
      items: List.unmodifiable(
        items.map(
          (item) => StorefrontProductListItemDto.fromJson(
            item as Map<String, Object?>,
          ),
        ),
      ),
      total: json['total'] as int,
      page: json['page'] as int,
      pageSize: json['pageSize'] as int,
      totalPages: json['totalPages'] as int,
      brandFacets: List.unmodifiable(
        facets.map(
          (facet) =>
              StorefrontBrandFacetDto.fromJson(facet as Map<String, Object?>),
        ),
      ),
    );
  }

  final List<StorefrontProductListItemDto> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;
  final List<StorefrontBrandFacetDto> brandFacets;

  ProductPage toEntity() {
    return ProductPage(
      items: List.unmodifiable(items.map((item) => item.toEntity())),
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages,
      brandFacets: List.unmodifiable(
        brandFacets.map((facet) => facet.toEntity()),
      ),
    );
  }
}

/// Converte o corpo de `GET /storefront/products` numa [ProductPage].
/// Qualquer outra forma de corpo lança, e o `runRequest` transforma isso em
/// falha inesperada.
ProductPage parseStorefrontProductPage(Object? data) {
  return StorefrontProductPageDto.fromJson(
    data as Map<String, Object?>,
  ).toEntity();
}
