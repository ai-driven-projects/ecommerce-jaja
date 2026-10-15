/// Códigos das falhas do carrinho, com os textos de
/// `apps/frontend/src/shared/i18n/messages.pt.ts` (`CART_*`) e o código do
/// backend que cada um traduz ([backendCode]). A falha das regras locais é
/// `ValidationFailure`; as recusas de `/me/cart` mantêm o tipo da falha HTTP.
enum CartErrorCode {
  quantityExceeded(
    'Limite de 99 unidades por produto.',
    'CART_ITEM_QUANTITY_EXCEEDED',
  ),
  itemsLimitExceeded(
    'O carrinho aceita até 50 produtos diferentes.',
    'CART_ITEMS_LIMIT_EXCEEDED',
  ),
  quantityInvalid('Quantidade inválida.', 'CART_ITEM_QUANTITY_INVALID'),
  productUnavailable('Produto indisponível.', 'CART_PRODUCT_NOT_FOUND');

  const CartErrorCode(this.message, this.backendCode);

  final String message;

  /// Código enviado pelo backend (`modules/orders/src/cart/errors.ts`).
  final String backendCode;
}

/// Primeiro código de [codes] que o carrinho conhece, na ordem recebida, ou
/// `null` se nenhum for conhecido.
CartErrorCode? cartErrorFromCodes(List<String> codes) {
  for (final code in codes) {
    for (final value in CartErrorCode.values) {
      if (value.backendCode == code) return value;
    }
  }
  return null;
}
