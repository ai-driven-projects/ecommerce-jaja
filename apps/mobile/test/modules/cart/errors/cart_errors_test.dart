import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';

void main() {
  group('cartErrorFromCodes', () {
    const expected = {
      'CART_ITEM_QUANTITY_EXCEEDED': CartErrorCode.quantityExceeded,
      'CART_ITEMS_LIMIT_EXCEEDED': CartErrorCode.itemsLimitExceeded,
      'CART_ITEM_QUANTITY_INVALID': CartErrorCode.quantityInvalid,
      'CART_PRODUCT_NOT_FOUND': CartErrorCode.productUnavailable,
    };

    for (final MapEntry(key: code, value: error) in expected.entries) {
      test('$code vira ${error.name}', () {
        expect(cartErrorFromCodes([code]), error);
        expect(error.backendCode, code);
      });
    }

    test('devolve o primeiro código conhecido, na ordem recebida', () {
      expect(
        cartErrorFromCodes(['ALGO_NOVO', 'CART_ITEMS_LIMIT_EXCEEDED']),
        CartErrorCode.itemsLimitExceeded,
      );
    });

    test('lista sem código conhecido devolve null', () {
      expect(cartErrorFromCodes(['ALGO_NOVO', 'CART_USER_NOT_FOUND']), isNull);
      expect(cartErrorFromCodes(const []), isNull);
    });
  });

  test('productUnavailable tem o texto de CART_PRODUCT_NOT_FOUND', () {
    expect(CartErrorCode.productUnavailable.message, 'Produto indisponível.');
  });
}
