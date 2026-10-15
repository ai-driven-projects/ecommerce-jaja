import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';

import '../../../ui/shared/support/money.dart';

CartItem item(String productId, int quantity) =>
    CartItem(productId: productId, quantity: quantity);

CartLine line(String productId, int quantity, {bool isAvailable = true}) {
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
    isAvailable: isAvailable,
    lineTotal: isAvailable ? money(1290 * quantity) : null,
  );
}

CartDetail detailOf(List<CartLine> lines) =>
    CartDetail.empty().copyWith(lines: lines);

const serverFailure = ServerFailure(
  message: 'Algo deu errado.',
  code: HttpFailureCode.server,
);

void main() {
  test('nasce vazio, com a prévia vazia', () {
    final state = CartState();

    expect(state.items, isEmpty);
    expect(state.isEmpty, isTrue);
    expect(state.count, 0);
    expect(state.detail, CartDetail.empty());
    expect(state.lines, isEmpty);
  });

  test('count soma as quantidades locais, inclusive de indisponíveis', () {
    final state = CartState(
      items: [item('a', 2), item('b', 3)],
      detail: detailOf([line('a', 1), line('b', 3, isAvailable: false)]),
    );

    expect(state.count, 5);
  });

  test('lines aplica a quantidade local e tira as ausentes', () {
    final state = CartState(
      items: [item('a', 4), item('c', 1)],
      detail: detailOf([line('a', 1), line('b', 2), line('c', 1)]),
    );

    expect(state.lines.map((line) => (line.productId, line.quantity)), [
      ('a', 4),
      ('c', 1),
    ]);
    expect(state.lines.last, same(state.detail.lines.last));
  });

  test('quantityOf devolve a quantidade local ou 0', () {
    final state = CartState(items: [item('a', 4)]);

    expect(state.quantityOf('a'), 4);
    expect(state.quantityOf(' A '), 4);
    expect(state.quantityOf('z'), 0);
  });

  group('awaitsFirstPreview', () {
    test('com itens, sem linhas e sem falha', () {
      expect(CartState(items: [item('a', 1)]).awaitsFirstPreview, isTrue);
    });

    test('não sem itens', () {
      expect(CartState().awaitsFirstPreview, isFalse);
    });

    test('não com linhas', () {
      final state = CartState(
        items: [item('a', 1)],
        detail: detailOf([line('a', 1)]),
      );

      expect(state.awaitsFirstPreview, isFalse);
    });

    test('não com falha da prévia', () {
      final state = CartState(
        items: [item('a', 1)],
        previewFailure: serverFailure,
      );

      expect(state.awaitsFirstPreview, isFalse);
    });
  });

  test('copyWith troca os campos e limpa a falha', () {
    final state = CartState(
      items: [item('a', 1)],
      isRestoring: true,
      previewFailure: serverFailure,
    );

    final next = state.copyWith(isRestoring: false, isSyncing: true);
    expect(next.items, [item('a', 1)]);
    expect(next.isRestoring, isFalse);
    expect(next.isSyncing, isTrue);
    expect(next.previewFailure, serverFailure);

    expect(state.copyWith(clearPreviewFailure: true).previewFailure, isNull);
  });

  test('items é imutável', () {
    final state = CartState(items: [item('a', 1)]);

    expect(() => state.items.add(item('b', 1)), throwsUnsupportedError);
  });
}
