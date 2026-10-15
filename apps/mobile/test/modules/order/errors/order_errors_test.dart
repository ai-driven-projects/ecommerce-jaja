import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/order/errors/order_errors.dart';

void main() {
  group('orderErrorFromCodes', () {
    const expected = {
      'ORDER_ALREADY_EXISTS': (
        OrderErrorCode.alreadyExists,
        'Este pedido já foi registrado.',
      ),
      'ORDER_CART_EMPTY': (
        OrderErrorCode.cartEmpty,
        'Seu carrinho está vazio.',
      ),
      'ORDER_CART_HAS_UNAVAILABLE_ITEMS': (
        OrderErrorCode.cartHasUnavailableItems,
        'Remova os itens indisponíveis para confirmar o pedido.',
      ),
      'ORDER_CUSTOMER_INACTIVE': (
        OrderErrorCode.customerInactive,
        'Seu cadastro está inativo. Fale com o atendimento.',
      ),
      'ORDER_CUSTOMER_NOT_FOUND': (
        OrderErrorCode.customerNotFound,
        'Não encontramos seu cadastro de cliente. Preencha os dados de '
            'entrega.',
      ),
      'ORDER_CUSTOMER_REQUIRED': (
        OrderErrorCode.customerRequired,
        'Preencha os dados de entrega para confirmar o pedido.',
      ),
      'ORDER_DELIVERY_ADDRESS_INVALID': (
        OrderErrorCode.deliveryAddressInvalid,
        'O endereço de entrega está incompleto. Revise os dados de entrega.',
      ),
      'ORDER_ITEMS_LIMIT_EXCEEDED': (
        OrderErrorCode.itemsLimitExceeded,
        'O pedido aceita até 50 produtos diferentes.',
      ),
      'ORDER_ITEMS_REQUIRED': (
        OrderErrorCode.itemsRequired,
        'O pedido precisa ter ao menos um produto.',
      ),
      'ORDER_ITEM_DUPLICATED': (
        OrderErrorCode.itemDuplicated,
        'O mesmo produto aparece mais de uma vez no pedido.',
      ),
      'ORDER_ITEM_PRICE_INVALID': (
        OrderErrorCode.itemPriceInvalid,
        'Um produto do carrinho está com preço inválido.',
      ),
      'ORDER_ITEM_QUANTITY_INVALID': (
        OrderErrorCode.itemQuantityInvalid,
        'Quantidade inválida em um produto do pedido.',
      ),
      'ORDER_PRODUCT_NOT_FOUND': (
        OrderErrorCode.productNotFound,
        'Um produto do carrinho não está mais disponível.',
      ),
      'TEXT_TOO_SHORT': (
        OrderErrorCode.textTooShort,
        'O texto não atingiu o tamanho mínimo permitido.',
      ),
      'TEXT_TOO_LONG': (
        OrderErrorCode.textTooLong,
        'O texto passou do tamanho máximo permitido.',
      ),
    };

    test('há um valor para cada código com texto', () {
      expect(OrderErrorCode.values, hasLength(expected.length));
    });

    for (final MapEntry(key: code, value: (error, message))
        in expected.entries) {
      test('$code vira ${error.name} com o texto do web', () {
        expect(orderErrorFromCodes([code]), error);
        expect(error.backendCode, code);
        expect(error.message, message);
      });
    }

    test('devolve o primeiro código conhecido, na ordem recebida', () {
      expect(
        orderErrorFromCodes(['ALGO_NOVO', 'ORDER_CART_EMPTY']),
        OrderErrorCode.cartEmpty,
      );
    });

    test('lista sem código conhecido devolve null', () {
      expect(orderErrorFromCodes(['ALGO_NOVO', 'ORDER_NOT_FOUND']), isNull);
      expect(orderErrorFromCodes(const []), isNull);
    });
  });

  group('isCustomerRejection', () {
    test('com ORDER_CUSTOMER_INACTIVE é recusa do cadastro', () {
      expect(isCustomerRejection(['ORDER_CUSTOMER_INACTIVE']), isTrue);
      expect(
        isCustomerRejection(['TEXT_TOO_SHORT', 'ORDER_CUSTOMER_REQUIRED']),
        isTrue,
      );
    });

    test('sem código ORDER_CUSTOMER_ não é', () {
      expect(
        isCustomerRejection(['ORDER_CART_HAS_UNAVAILABLE_ITEMS']),
        isFalse,
      );
      expect(isCustomerRejection(const []), isFalse);
    });
  });
}
