/// Códigos das recusas de `POST /me/orders`, com os textos de
/// `apps/frontend/src/shared/i18n/messages.pt.ts` (`ORDER_*` e `TEXT_*`) e o
/// código do backend que cada um traduz ([backendCode]). As recusas mantêm o
/// tipo da falha HTTP.
enum OrderErrorCode {
  alreadyExists('Este pedido já foi registrado.', 'ORDER_ALREADY_EXISTS'),
  cartEmpty('Seu carrinho está vazio.', 'ORDER_CART_EMPTY'),
  cartHasUnavailableItems(
    'Remova os itens indisponíveis para confirmar o pedido.',
    'ORDER_CART_HAS_UNAVAILABLE_ITEMS',
  ),
  customerInactive(
    'Seu cadastro está inativo. Fale com o atendimento.',
    'ORDER_CUSTOMER_INACTIVE',
  ),
  customerNotFound(
    'Não encontramos seu cadastro de cliente. Preencha os dados de entrega.',
    'ORDER_CUSTOMER_NOT_FOUND',
  ),
  customerRequired(
    'Preencha os dados de entrega para confirmar o pedido.',
    'ORDER_CUSTOMER_REQUIRED',
  ),
  deliveryAddressInvalid(
    'O endereço de entrega está incompleto. Revise os dados de entrega.',
    'ORDER_DELIVERY_ADDRESS_INVALID',
  ),
  itemsLimitExceeded(
    'O pedido aceita até 50 produtos diferentes.',
    'ORDER_ITEMS_LIMIT_EXCEEDED',
  ),
  itemsRequired(
    'O pedido precisa ter ao menos um produto.',
    'ORDER_ITEMS_REQUIRED',
  ),
  itemDuplicated(
    'O mesmo produto aparece mais de uma vez no pedido.',
    'ORDER_ITEM_DUPLICATED',
  ),
  itemPriceInvalid(
    'Um produto do carrinho está com preço inválido.',
    'ORDER_ITEM_PRICE_INVALID',
  ),
  itemQuantityInvalid(
    'Quantidade inválida em um produto do pedido.',
    'ORDER_ITEM_QUANTITY_INVALID',
  ),
  productNotFound(
    'Um produto do carrinho não está mais disponível.',
    'ORDER_PRODUCT_NOT_FOUND',
  ),
  textTooShort(
    'O texto não atingiu o tamanho mínimo permitido.',
    'TEXT_TOO_SHORT',
  ),
  textTooLong('O texto passou do tamanho máximo permitido.', 'TEXT_TOO_LONG');

  const OrderErrorCode(this.message, this.backendCode);

  final String message;

  /// Código enviado pelo backend (`modules/orders/src/order/errors.ts` e os
  /// `TEXT_*` do pacote compartilhado).
  final String backendCode;
}

/// Primeiro código de [codes] que o pedido conhece, na ordem recebida, ou
/// `null` se nenhum for conhecido.
OrderErrorCode? orderErrorFromCodes(List<String> codes) {
  for (final code in codes) {
    for (final value in OrderErrorCode.values) {
      if (value.backendCode == code) return value;
    }
  }
  return null;
}

/// Se a recusa é do cadastro de cliente (algum código `ORDER_CUSTOMER_*`),
/// como o `isCustomerFailure` de `checkout.page.tsx`: o checkout relê os
/// dados de entrega.
bool isCustomerRejection(List<String> codes) =>
    codes.any((code) => code.startsWith('ORDER_CUSTOMER_'));
