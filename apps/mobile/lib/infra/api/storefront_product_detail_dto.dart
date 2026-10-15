import '../../core/result.dart';
import '../../core/value_objects/money.dart';
import '../../modules/catalog/model/product_detail_entity.dart';

/// Marca ou categoria do detalhe (`StorefrontCategoryRefDTO` em
/// `modules/catalog/src/product/dto/storefront-product.dto.ts`).
final class StorefrontCatalogRefDto {
  const StorefrontCatalogRefDto({required this.slug, required this.name});

  factory StorefrontCatalogRefDto.fromJson(Map<String, Object?> json) {
    return StorefrontCatalogRefDto(
      slug: json['slug'] as String,
      name: json['name'] as String,
    );
  }

  final String slug;
  final String name;

  CatalogRef toEntity() => CatalogRef(slug: slug, name: name);
}

/// Foto do produto (`ProductImageDTO` em
/// `modules/catalog/src/product/dto/product.dto.ts`).
final class ProductImageDto {
  const ProductImageDto({
    required this.thumbUrl,
    required this.largeUrl,
    required this.order,
  });

  factory ProductImageDto.fromJson(Map<String, Object?> json) {
    return ProductImageDto(
      thumbUrl: json['thumbUrl'] as String,
      largeUrl: json['largeUrl'] as String,
      order: json['order'] as int,
    );
  }

  final String thumbUrl;
  final String largeUrl;
  final int order;

  ProductImage toEntity() =>
      ProductImage(thumbUrl: thumbUrl, largeUrl: largeUrl, order: order);
}

/// Detalhe do produto como `GET /storefront/products/:slug` o devolve:
/// `StorefrontProductDetailDTO` em
/// `modules/catalog/src/product/dto/storefront-product.dto.ts`, escrito à
/// mão.
///
/// Os casts são estritos, como no DTO da listagem: campo ausente ou de outro
/// tipo lança `TypeError`; centavos negativos lançam `FormatException`. Nos
/// dois casos o `runRequest` converte em falha inesperada. Campos a mais são
/// ignorados. A trilha mantém a ordem recebida; as fotos são ordenadas por
/// `order` (a API já ordena, mas o app não depende disso).
final class StorefrontProductDetailDto {
  const StorefrontProductDetailDto({
    required this.id,
    required this.slug,
    required this.name,
    required this.sku,
    required this.description,
    required this.priceCents,
    required this.listPriceCents,
    required this.discountPercent,
    required this.unit,
    required this.isFeatured,
    required this.brand,
    required this.categories,
    required this.images,
  });

  factory StorefrontProductDetailDto.fromJson(Map<String, Object?> json) {
    final brand = json['brand'] as Map<String, Object?>?;
    final categories = json['categories'] as List<Object?>;
    final images = json['images'] as List<Object?>;
    return StorefrontProductDetailDto(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String?,
      description: json['description'] as String?,
      priceCents: json['priceCents'] as int,
      listPriceCents: json['listPriceCents'] as int?,
      discountPercent: json['discountPercent'] as int?,
      unit: json['unit'] as String,
      isFeatured: json['isFeatured'] as bool,
      brand: brand == null ? null : StorefrontCatalogRefDto.fromJson(brand),
      categories: List.unmodifiable(
        categories.map(
          (category) => StorefrontCatalogRefDto.fromJson(
            category as Map<String, Object?>,
          ),
        ),
      ),
      images: List.unmodifiable(
        images.map(
          (image) => ProductImageDto.fromJson(image as Map<String, Object?>),
        ),
      ),
    );
  }

  final String id;
  final String slug;
  final String name;
  final String? sku;
  final String? description;
  final int priceCents;
  final int? listPriceCents;
  final int? discountPercent;
  final String unit;
  final bool isFeatured;
  final StorefrontCatalogRefDto? brand;
  final List<StorefrontCatalogRefDto> categories;
  final List<ProductImageDto> images;

  ProductDetail toEntity() {
    final listPriceCents = this.listPriceCents;
    final sorted = [...images]..sort((a, b) => a.order.compareTo(b.order));
    return ProductDetail(
      id: id,
      slug: slug,
      name: name,
      sku: sku,
      description: description,
      price: _money(priceCents, 'priceCents'),
      listPrice: listPriceCents == null
          ? null
          : _money(listPriceCents, 'listPriceCents'),
      discountPercent: discountPercent,
      unit: unit,
      isFeatured: isFeatured,
      brand: brand?.toEntity(),
      categories: List.unmodifiable(
        categories.map((category) => category.toEntity()),
      ),
      images: List.unmodifiable(sorted.map((image) => image.toEntity())),
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

/// Converte o corpo de `GET /storefront/products/:slug` num [ProductDetail].
/// Qualquer outra forma de corpo lança, e o `runRequest` transforma isso em
/// falha inesperada.
ProductDetail parseStorefrontProductDetail(Object? data) {
  return StorefrontProductDetailDto.fromJson(
    data as Map<String, Object?>,
  ).toEntity();
}
