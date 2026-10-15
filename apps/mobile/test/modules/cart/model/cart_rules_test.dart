import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_rules.dart';

CartItem item(String productId, int quantity) =>
    CartItem(productId: productId, quantity: quantity);

List<CartItem> productsUpTo(int count) => [
  for (var index = 1; index <= count; index++) item('p$index', 1),
];

List<CartItem> itemsOf(Result<List<CartItem>> result) => switch (result) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void expectFailure(Result<List<CartItem>> result, CartErrorCode code) {
  expect(
    result,
    isA<Failure<List<CartItem>>>().having(
      (failure) => failure.failure,
      'failure',
      isA<ValidationFailure>()
          .having((failure) => failure.code, 'code', code)
          .having((failure) => failure.message, 'message', code.message),
    ),
  );
}

void main() {
  test('as constantes são as de modules/orders/src/cart/errors.ts', () {
    expect(cartItemMaxQuantity, 99);
    expect(cartMaxItems, 50);
    expect(deliveryFee.cents, 490);
    expect(freeDeliveryThreshold.cents, 7900);
  });

  group('normalizeCartItems', () {
    test('normaliza o conteúdo guardado irregular', () {
      final items = normalizeCartItems([
        {'productId': ' A ', 'quantity': 60},
        {'productId': 'a', 'quantity': 60},
        {'productId': 'b', 'quantity': 0},
        {'quantity': 2},
      ]);

      expect(items, [item('a', 99)]);
    });

    test('descarta entradas inválidas e mantém a ordem', () {
      final items = normalizeCartItems([
        {'productId': 'x', 'quantity': 2},
        'texto',
        null,
        {'productId': '  ', 'quantity': 1},
        {'productId': 7, 'quantity': 1},
        {'productId': 'c', 'quantity': 1.5},
        {'productId': 'd', 'quantity': -1},
        {'productId': 'e', 'quantity': '2'},
        {'productId': 'f', 'quantity': 2.0},
        {'productId': 'X', 'quantity': 1},
      ]);

      expect(items, [item('x', 3), item('f', 2)]);
    });

    test('o que não é lista vira carrinho vazio', () {
      expect(normalizeCartItems(null), isEmpty);
      expect(normalizeCartItems({'productId': 'a', 'quantity': 1}), isEmpty);
      expect(normalizeCartItems('[]'), isEmpty);
    });

    test('mantém só os primeiros 50 produtos', () {
      final stored = [
        for (var index = 1; index <= 51; index++)
          {'productId': 'p$index', 'quantity': 1},
        {'productId': 'p1', 'quantity': 1},
      ];

      final items = normalizeCartItems(stored);

      expect(items, hasLength(50));
      expect(items.first, item('p1', 2));
      expect(items.last.productId, 'p50');
    });
  });

  group('addCartItem', () {
    test('soma ao produto existente mantendo a posição', () {
      final items = [item('a', 2), item('b', 1)];

      expect(itemsOf(addCartItem(items, 'a', 3)), [item('a', 5), item('b', 1)]);
    });

    test('inclui produto novo no fim, com o id aparado em minúsculas', () {
      final items = [item('a', 2)];

      expect(itemsOf(addCartItem(items, ' B ', 1)), [
        item('a', 2),
        item('b', 1),
      ]);
    });

    test('98 + 3 falha com quantityExceeded', () {
      expectFailure(
        addCartItem([item('a', 98)], 'a', 3),
        CartErrorCode.quantityExceeded,
      );
    });

    test('o 51º produto falha com itemsLimitExceeded', () {
      expectFailure(
        addCartItem(productsUpTo(50), 'novo', 1),
        CartErrorCode.itemsLimitExceeded,
      );
    });

    test('com 50 produtos, somar a um existente é aceito', () {
      final items = itemsOf(addCartItem(productsUpTo(50), 'p50', 1));

      expect(items.last, item('p50', 2));
    });

    for (final quantity in [0, -1, 100]) {
      test('quantidade $quantity falha com quantityInvalid', () {
        expectFailure(
          addCartItem([item('a', 1)], 'a', quantity),
          CartErrorCode.quantityInvalid,
        );
      });
    }

    test('não muda a lista recebida', () {
      final items = [item('a', 2)];

      addCartItem(items, 'a', 3);
      addCartItem(items, 'b', 1);

      expect(items, [item('a', 2)]);
    });
  });

  group('setCartItemQuantity', () {
    test('define a quantidade mantendo a posição', () {
      final items = [item('a', 2), item('b', 1)];

      expect(itemsOf(setCartItemQuantity(items, 'a', 7)), [
        item('a', 7),
        item('b', 1),
      ]);
    });

    test('produto ausente entra no fim', () {
      expect(itemsOf(setCartItemQuantity([item('a', 1)], 'b', 4)), [
        item('a', 1),
        item('b', 4),
      ]);
    });

    test('0 remove o produto', () {
      final items = [item('a', 2), item('b', 1)];

      expect(itemsOf(setCartItemQuantity(items, 'a', 0)), [item('b', 1)]);
    });

    test('100 falha com quantityExceeded', () {
      expectFailure(
        setCartItemQuantity([item('a', 1)], 'a', 100),
        CartErrorCode.quantityExceeded,
      );
    });

    test('negativa falha com quantityInvalid', () {
      expectFailure(
        setCartItemQuantity([item('a', 1)], 'a', -1),
        CartErrorCode.quantityInvalid,
      );
    });

    test('o 51º produto falha com itemsLimitExceeded', () {
      expectFailure(
        setCartItemQuantity(productsUpTo(50), 'novo', 1),
        CartErrorCode.itemsLimitExceeded,
      );
    });

    test('não muda a lista recebida', () {
      final items = [item('a', 2)];

      setCartItemQuantity(items, 'a', 5);
      setCartItemQuantity(items, 'a', 0);

      expect(items, [item('a', 2)]);
    });
  });

  group('removeCartItem', () {
    test('tira o produto, comparando o id aparado em minúsculas', () {
      final items = [item('a', 2), item('b', 1)];

      expect(removeCartItem(items, ' A '), [item('b', 1)]);
      expect(items, [item('a', 2), item('b', 1)]);
    });

    test('produto ausente devolve a mesma lista', () {
      expect(removeCartItem([item('a', 2)], 'z'), [item('a', 2)]);
    });
  });
}
