import 'package:freezed_annotation/freezed_annotation.dart';

import 'product_summary_entity.dart';

part 'product_page_entity.freezed.dart';

/// Marca presente no resultado de uma listagem, contada com todos os filtros
/// menos o de marca (`StorefrontBrandFacetDTO`).
@freezed
abstract class BrandFacet with _$BrandFacet {
  const factory BrandFacet({
    required String slug,
    required String name,
    required int count,
  }) = _BrandFacet;
}

/// Uma página de `GET /storefront/products` (`StorefrontProductPageDTO`).
@freezed
abstract class ProductPage with _$ProductPage {
  const factory ProductPage({
    required List<ProductSummary> items,
    required int total,
    required int page,
    required int pageSize,
    required int totalPages,
    required List<BrandFacet> brandFacets,
  }) = _ProductPage;
}
