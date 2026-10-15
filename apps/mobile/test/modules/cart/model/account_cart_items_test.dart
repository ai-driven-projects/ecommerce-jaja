import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/cart/model/account_cart_items.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';

import '../../../ui/shared/support/money.dart';

CartItem item(String productId, int quantity) =>
    CartItem(productId: productId, quantity: quantity);

CartLine line(String productId, int quantity) {
  return CartLine(
    productId: productId,
    slug: 'produto-$productId',
    name: 'Produto $productId',
    unit: 'un',
    rootCategorySlug: 'papelaria',
    thumbUrl: null,
    price: money(1290),
    listPrice: null,
    quantity: quantity,
    isAvailable: true,
    lineTotal: money(1290 * quantity),
  );
}

CartDetail detailOf(List<CartLine> lines) =>
    CartDetail.empty().copyWith(lines: lines);

void main() {
  final detail = detailOf([line('a', 2), line('b', 1), line('c', 3)]);

  test('sem detail nem overrides não há itens', () {
    expect(accountCartItems(null, const {}), isEmpty);
  });

  test('sem overrides devolve as linhas, na ordem delas', () {
    expect(accountCartItems(detail, const {}), [
      item('a', 2),
      item('b', 1),
      item('c', 3),
    ]);
  });

  test('override muda a quantidade na posição da linha', () {
    expect(accountCartItems(detail, const {'b': 5}), [
      item('a', 2),
      item('b', 5),
      item('c', 3),
    ]);
  });

  test('override 0 tira a linha', () {
    expect(accountCartItems(detail, const {'a': 0}), [
      item('b', 1),
      item('c', 3),
    ]);
  });

  test('produto novo entra no fim, na ordem de inserção', () {
    final overrides = <String, int>{'z': 1, 'b': 4, 'y': 2, 'x': 0};

    expect(accountCartItems(detail, overrides), [
      item('a', 2),
      item('b', 4),
      item('c', 3),
      item('z', 1),
      item('y', 2),
    ]);
    expect(accountCartItems(null, overrides), [
      item('z', 1),
      item('b', 4),
      item('y', 2),
    ]);
  });

  test('id da linha é posto em minúsculas para casar com o override', () {
    final upper = detailOf([line('ABC', 2)]);

    expect(accountCartItems(upper, const {'abc': 7}), [item('abc', 7)]);
  });

  test('CartState.count soma o resultado', () {
    final state = CartState(
      items: accountCartItems(detail, const {'a': 0, 'c': 10, 'd': 4}),
      detail: detail,
    );

    expect(state.count, 1 + 10 + 4);
    expect(state.quantityOf('C'), 10);
    expect(state.lines.map((line) => line.productId), ['b', 'c']);
  });
}
