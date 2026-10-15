import '../../../core/errors/app_failure.dart';
import '../../../core/result.dart';
import '../../../core/value_objects/money.dart';
import '../errors/cart_errors.dart';
import 'cart_entity.dart';

// Limites e entrega copiados de `modules/orders/src/cart/errors.ts`
// (`CART_ITEM_MAX_QUANTITY`, `CART_MAX_ITEMS`, `DELIVERY_FEE_CENTS`,
// `FREE_DELIVERY_THRESHOLD_CENTS`). Os valores exibidos vêm sempre da prévia;
// estas constantes só decidem as regras do visitante e os textos da loja.

/// Unidades de um mesmo produto no carrinho.
const cartItemMaxQuantity = 99;

/// Produtos diferentes no carrinho.
const cartMaxItems = 50;

/// Taxa fixa de entrega abaixo de [freeDeliveryThreshold].
final deliveryFee = _cents(490);

/// Subtotal a partir do qual a entrega é grátis.
final freeDeliveryThreshold = _cents(7900);

Money _cents(int cents) => switch (Money.fromCents(cents)) {
  Ok(:final value) => value,
  Failure() => throw StateError('Valor de entrega negativo: $cents'),
};

// Regras do visitante copiadas de `normalizeItems`
// (`apps/frontend/src/modules/orders/data/guest-cart-storage.util.ts`) e de
// `addGuestItem`/`setGuestItemQuantity`/`removeGuestItem` (`cart.util.ts`),
// na mesma ordem de checagem. O id é aparado e posto em minúsculas, como faz o
// `toGuestItems` do backend, para casar com o que a prévia devolve.

/// Normaliza o conteúdo guardado, já decodificado do JSON: descarta entradas
/// sem `productId` texto não vazio ou sem quantidade inteira ≥ 1, soma ids
/// repetidos na primeira posição, limita a [cartItemMaxQuantity] e mantém os
/// primeiros [cartMaxItems] produtos. Não lista vira carrinho vazio.
List<CartItem> normalizeCartItems(Object? value) {
  if (value is! List) return const [];

  final quantities = <String, int>{};
  for (final entry in value) {
    if (entry is! Map) continue;
    final productId = entry['productId'];
    final quantity = _wholeNumber(entry['quantity']);
    if (productId is! String || productId.trim().isEmpty) continue;
    if (quantity == null || quantity < 1) continue;

    final key = _normalizeId(productId);
    if (!quantities.containsKey(key) && quantities.length >= cartMaxItems) {
      continue;
    }
    final total = (quantities[key] ?? 0) + quantity;
    quantities[key] = total > cartItemMaxQuantity ? cartItemMaxQuantity : total;
  }

  return List.unmodifiable([
    for (final MapEntry(:key, :value) in quantities.entries)
      CartItem(productId: key, quantity: value),
  ]);
}

/// Soma [quantity] ao produto, mantendo a posição, ou o inclui no fim. Soma
/// acima de [cartItemMaxQuantity] → `quantityExceeded`; produto além de
/// [cartMaxItems] → `itemsLimitExceeded`; quantidade fora de 1 a 99 →
/// `quantityInvalid`. Nunca muda [items].
Result<List<CartItem>> addCartItem(
  List<CartItem> items,
  String productId,
  int quantity,
) {
  if (!_isValidQuantity(quantity)) {
    return _failure(CartErrorCode.quantityInvalid);
  }

  final id = _normalizeId(productId);
  final existing = items.where((item) => item.productId == id).firstOrNull;
  if (existing != null) {
    final total = existing.quantity + quantity;
    if (total > cartItemMaxQuantity) {
      return _failure(CartErrorCode.quantityExceeded);
    }
    return Ok(_replace(items, id, total));
  }

  if (items.length >= cartMaxItems) {
    return _failure(CartErrorCode.itemsLimitExceeded);
  }
  return Ok(
    List.unmodifiable([...items, CartItem(productId: id, quantity: quantity)]),
  );
}

/// Define a quantidade do produto, mantendo a posição, ou o inclui no fim; 0
/// remove. Acima de [cartItemMaxQuantity] → `quantityExceeded`; produto além
/// de [cartMaxItems] → `itemsLimitExceeded`; negativa → `quantityInvalid`.
/// Nunca muda [items].
Result<List<CartItem>> setCartItemQuantity(
  List<CartItem> items,
  String productId,
  int quantity,
) {
  if (quantity == 0) return Ok(removeCartItem(items, productId));
  if (quantity > cartItemMaxQuantity) {
    return _failure(CartErrorCode.quantityExceeded);
  }
  if (!_isValidQuantity(quantity)) {
    return _failure(CartErrorCode.quantityInvalid);
  }

  final id = _normalizeId(productId);
  if (items.any((item) => item.productId == id)) {
    return Ok(_replace(items, id, quantity));
  }

  if (items.length >= cartMaxItems) {
    return _failure(CartErrorCode.itemsLimitExceeded);
  }
  return Ok(
    List.unmodifiable([...items, CartItem(productId: id, quantity: quantity)]),
  );
}

/// Tira o produto; ausente devolve uma cópia da mesma lista. Nunca muda
/// [items].
List<CartItem> removeCartItem(List<CartItem> items, String productId) {
  final id = _normalizeId(productId);
  return List.unmodifiable(items.where((item) => item.productId != id));
}

/// Inteiro do JSON; `2.0` também conta, como no `Number.isInteger` do web.
int? _wholeNumber(Object? value) {
  if (value is int) return value;
  if (value is double && value.isFinite && value == value.truncateToDouble()) {
    return value.toInt();
  }
  return null;
}

String _normalizeId(String productId) => productId.trim().toLowerCase();

bool _isValidQuantity(int quantity) =>
    quantity >= 1 && quantity <= cartItemMaxQuantity;

List<CartItem> _replace(List<CartItem> items, String id, int quantity) {
  return List.unmodifiable([
    for (final item in items)
      item.productId == id ? CartItem(productId: id, quantity: quantity) : item,
  ]);
}

Result<List<CartItem>> _failure(CartErrorCode code) {
  return Failure(ValidationFailure(message: code.message, code: code));
}
