import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../core/value_objects/money.dart';
import 'cart_rules.dart' as rules;

part 'cart_entity.freezed.dart';

/// Produto e quantidade como ficam guardados (`CartItemInputDTO`). Nenhum
/// preço é guardado.
@freezed
abstract class CartItem with _$CartItem {
  const factory CartItem({required String productId, required int quantity}) =
      _CartItem;
}

/// Linha do carrinho com os dados atuais do catálogo (`CartLineDTO`).
/// [lineTotal] é `null` quando a linha está indisponível; [thumbUrl], sem
/// fotos.
@freezed
abstract class CartLine with _$CartLine {
  const factory CartLine({
    required String productId,
    required String slug,
    required String name,
    required String unit,
    required String rootCategorySlug,
    required String? thumbUrl,
    required Money price,
    required Money? listPrice,
    required int quantity,
    required bool isAvailable,
    required Money? lineTotal,
  }) = _CartLine;
}

/// Carrinho precificado pela API (`CartDetailDTO`), com as [lines] na ordem
/// de inclusão. [itemCount] soma as quantidades de todas as linhas, inclusive
/// as indisponíveis; [subtotal] só as disponíveis.
@freezed
abstract class CartDetail with _$CartDetail {
  const factory CartDetail({
    required List<CartLine> lines,
    required int itemCount,
    required Money subtotal,
    required Money deliveryFee,
    required Money total,
    required Money freeDeliveryThreshold,
    required Money missingForFreeDelivery,
    required bool hasUnavailableItems,
  }) = _CartDetail;

  /// Carrinho vazio, com os totais zerados (o `emptyCartDetail` de
  /// `apps/frontend/src/modules/orders/data/cart.util.ts`).
  factory CartDetail.empty() => CartDetail(
    lines: const [],
    itemCount: 0,
    subtotal: Money.zero,
    deliveryFee: Money.zero,
    total: Money.zero,
    freeDeliveryThreshold: rules.freeDeliveryThreshold,
    missingForFreeDelivery: Money.zero,
    hasUnavailableItems: false,
  );
}
