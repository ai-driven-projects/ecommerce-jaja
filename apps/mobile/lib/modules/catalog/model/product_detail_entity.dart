import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../core/value_objects/money.dart';

part 'product_detail_entity.freezed.dart';

/// Marca ou categoria citada pelo detalhe (`StorefrontCategoryRefDTO`).
@freezed
abstract class CatalogRef with _$CatalogRef {
  const factory CatalogRef({required String slug, required String name}) =
      _CatalogRef;
}

/// Foto do produto (`ProductImageDTO`): [order] 0 é a principal.
@freezed
abstract class ProductImage with _$ProductImage {
  const factory ProductImage({
    required String thumbUrl,
    required String largeUrl,
    required int order,
  }) = _ProductImage;
}

/// Página do produto, com os campos de `StorefrontProductDetailDTO`.
/// [categories] vai da raiz até a categoria do produto, na ordem da API;
/// [images] fica ordenada por [ProductImage.order]. [discountPercent] vem
/// pronto da API (o app não calcula).
@freezed
abstract class ProductDetail with _$ProductDetail {
  const factory ProductDetail({
    required String id,
    required String slug,
    required String name,
    required String? sku,
    required String? description,
    required Money price,
    required Money? listPrice,
    required int? discountPercent,
    required String unit,
    required bool isFeatured,
    required CatalogRef? brand,
    required List<CatalogRef> categories,
    required List<ProductImage> images,
  }) = _ProductDetail;
}
