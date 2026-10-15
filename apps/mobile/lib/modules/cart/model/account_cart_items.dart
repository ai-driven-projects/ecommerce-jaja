import 'cart_entity.dart';

/// Itens exibidos do carrinho da conta: as linhas de [detail], na ordem
/// delas, com a quantidade de [overrides] quando houver (0 tira a linha), e
/// depois os produtos de [overrides] que ainda não são linha (> 0), na ordem
/// de inserção. É o `applyQuantities` + `added` de
/// `apps/frontend/src/modules/orders/data/cart.context.tsx`.
///
/// As chaves de [overrides] são ids aparados e em minúsculas, como os das
/// regras de `cart_rules.dart`; os ids das linhas são postos em minúsculas.
List<CartItem> accountCartItems(
  CartDetail? detail,
  Map<String, int> overrides,
) {
  final lineIds = <String>{};
  final items = <CartItem>[];
  for (final line in detail?.lines ?? const <CartLine>[]) {
    final id = line.productId.toLowerCase();
    lineIds.add(id);
    final quantity = overrides[id] ?? line.quantity;
    if (quantity > 0) items.add(CartItem(productId: id, quantity: quantity));
  }
  for (final MapEntry(key: id, value: quantity) in overrides.entries) {
    if (!lineIds.contains(id) && quantity > 0) {
      items.add(CartItem(productId: id, quantity: quantity));
    }
  }
  return List.unmodifiable(items);
}
