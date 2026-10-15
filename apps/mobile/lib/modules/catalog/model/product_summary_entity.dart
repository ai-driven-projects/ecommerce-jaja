import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../core/value_objects/money.dart';

part 'product_summary_entity.freezed.dart';

/// Card da listagem da vitrine, com os campos de
/// `StorefrontProductListItemDTO`. [discountPercent] vem pronto da API (o app
/// não calcula); [rootCategorySlug] escolhe o emoji e o tom de reserva.
@freezed
abstract class ProductSummary with _$ProductSummary {
  const factory ProductSummary({
    required String id,
    required String slug,
    required String name,
    required String? brandName,
    required String categoryName,
    required String rootCategorySlug,
    required Money price,
    required Money? listPrice,
    required int? discountPercent,
    required String unit,
    required String? thumbUrl,
    required bool isFeatured,
  }) = _ProductSummary;
}
