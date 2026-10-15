import '../../core/result.dart';
import '../../core/value_objects/money.dart';
import '../../modules/cart/model/cart_entity.dart';

/// Linha da prévia como `POST /cart/preview` a devolve: `CartLineDTO` em
/// `modules/orders/src/cart/dto/cart.dto.ts`, escrito à mão.
final class CartLineDto {
  const CartLineDto({
    required this.productId,
    required this.slug,
    required this.name,
    required this.unit,
    required this.rootCategorySlug,
    required this.thumbUrl,
    required this.priceCents,
    required this.listPriceCents,
    required this.quantity,
    required this.isAvailable,
    required this.lineTotalCents,
  });

  factory CartLineDto.fromJson(Map<String, Object?> json) {
    return CartLineDto(
      productId: _required<String>(json, 'productId'),
      slug: _required<String>(json, 'slug'),
      name: _required<String>(json, 'name'),
      unit: _required<String>(json, 'unit'),
      rootCategorySlug: _required<String>(json, 'rootCategorySlug'),
      thumbUrl: _nullable<String>(json, 'thumbUrl'),
      priceCents: _required<int>(json, 'priceCents'),
      listPriceCents: _nullable<int>(json, 'listPriceCents'),
      quantity: _required<int>(json, 'quantity'),
      isAvailable: _required<bool>(json, 'isAvailable'),
      lineTotalCents: _nullable<int>(json, 'lineTotalCents'),
    );
  }

  final String productId;
  final String slug;
  final String name;
  final String unit;
  final String rootCategorySlug;
  final String? thumbUrl;
  final int priceCents;
  final int? listPriceCents;
  final int quantity;
  final bool isAvailable;
  final int? lineTotalCents;

  CartLine toEntity() {
    final listPriceCents = this.listPriceCents;
    final lineTotalCents = this.lineTotalCents;
    return CartLine(
      productId: productId,
      slug: slug,
      name: name,
      unit: unit,
      rootCategorySlug: rootCategorySlug,
      thumbUrl: thumbUrl,
      price: _money(priceCents, 'priceCents'),
      listPrice: listPriceCents == null
          ? null
          : _money(listPriceCents, 'listPriceCents'),
      quantity: quantity,
      isAvailable: isAvailable,
      lineTotal: lineTotalCents == null
          ? null
          : _money(lineTotalCents, 'lineTotalCents'),
    );
  }
}

/// Carrinho precificado como `POST /cart/preview` o devolve: `CartDetailDTO`
/// em `modules/orders/src/cart/dto/cart.dto.ts`, escrito à mão.
///
/// Os casts são estritos: campo ausente, de outro tipo ou centavos negativos
/// lançam `FormatException` com o nome do campo, e o `runRequest` converte em
/// falha inesperada. Campos a mais são ignorados. As linhas mantêm a ordem
/// recebida (a de inclusão no carrinho).
final class CartDetailDto {
  const CartDetailDto({
    required this.lines,
    required this.itemCount,
    required this.subtotalCents,
    required this.deliveryFeeCents,
    required this.totalCents,
    required this.freeDeliveryThresholdCents,
    required this.missingForFreeDeliveryCents,
    required this.hasUnavailableItems,
  });

  factory CartDetailDto.fromJson(Map<String, Object?> json) {
    final lines = _required<List<Object?>>(json, 'lines');
    return CartDetailDto(
      lines: List.unmodifiable(
        lines.map((line) {
          if (line is! Map<String, Object?>) {
            throw const FormatException('lines: linha fora do formato');
          }
          return CartLineDto.fromJson(line);
        }),
      ),
      itemCount: _required<int>(json, 'itemCount'),
      subtotalCents: _required<int>(json, 'subtotalCents'),
      deliveryFeeCents: _required<int>(json, 'deliveryFeeCents'),
      totalCents: _required<int>(json, 'totalCents'),
      freeDeliveryThresholdCents: _required<int>(
        json,
        'freeDeliveryThresholdCents',
      ),
      missingForFreeDeliveryCents: _required<int>(
        json,
        'missingForFreeDeliveryCents',
      ),
      hasUnavailableItems: _required<bool>(json, 'hasUnavailableItems'),
    );
  }

  final List<CartLineDto> lines;
  final int itemCount;
  final int subtotalCents;
  final int deliveryFeeCents;
  final int totalCents;
  final int freeDeliveryThresholdCents;
  final int missingForFreeDeliveryCents;
  final bool hasUnavailableItems;

  CartDetail toEntity() {
    return CartDetail(
      lines: List.unmodifiable(lines.map((line) => line.toEntity())),
      itemCount: itemCount,
      subtotal: _money(subtotalCents, 'subtotalCents'),
      deliveryFee: _money(deliveryFeeCents, 'deliveryFeeCents'),
      total: _money(totalCents, 'totalCents'),
      freeDeliveryThreshold: _money(
        freeDeliveryThresholdCents,
        'freeDeliveryThresholdCents',
      ),
      missingForFreeDelivery: _money(
        missingForFreeDeliveryCents,
        'missingForFreeDeliveryCents',
      ),
      hasUnavailableItems: hasUnavailableItems,
    );
  }
}

/// Converte o corpo de `POST /cart/preview` num [CartDetail]. Qualquer outra
/// forma de corpo lança `FormatException`, e o `runRequest` transforma isso em
/// falha inesperada.
CartDetail parseCartDetail(Object? data) {
  if (data is! Map<String, Object?>) {
    throw const FormatException('corpo da prévia fora do formato');
  }
  return CartDetailDto.fromJson(data).toEntity();
}

/// Corpo de `POST /cart/preview` (`CartItemInputDTO[]` em `items`), na ordem
/// do carrinho.
Map<String, Object?> encodeCartItems(List<CartItem> items) => {
  'items': [
    for (final item in items)
      {'productId': item.productId, 'quantity': item.quantity},
  ],
};

T _required<T extends Object>(Map<String, Object?> json, String field) {
  final value = json[field];
  if (value is T) return value;
  throw FormatException('$field ausente ou fora do formato ($value)');
}

T? _nullable<T extends Object>(Map<String, Object?> json, String field) {
  if (!json.containsKey(field)) {
    throw FormatException('$field ausente');
  }
  final value = json[field];
  if (value == null || value is T) return value as T?;
  throw FormatException('$field fora do formato ($value)');
}

Money _money(int cents, String field) {
  return switch (Money.fromCents(cents)) {
    Ok(:final value) => value,
    Failure(:final failure) => throw FormatException(
      '$field fora do formato ($cents): ${failure.message}',
    ),
  };
}
