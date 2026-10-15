/// Códigos das falhas das regras do carrinho, com os textos de
/// `apps/frontend/src/shared/i18n/messages.pt.ts` (`CART_*`). A falha é
/// `ValidationFailure`.
enum CartErrorCode {
  quantityExceeded('Limite de 99 unidades por produto.'),
  itemsLimitExceeded('O carrinho aceita até 50 produtos diferentes.'),
  quantityInvalid('Quantidade inválida.');

  const CartErrorCode(this.message);

  final String message;
}
