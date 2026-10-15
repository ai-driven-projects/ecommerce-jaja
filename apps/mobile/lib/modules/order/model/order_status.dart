/// Status do pedido, na ordem de `ORDER_STATUSES`
/// (`modules/orders/src/order/errors.ts`): cada passo só avança para o
/// seguinte, e [delivered] é o último. [backendCode] é o código que a API
/// envia.
enum OrderStatus {
  placed('PLACED'),
  paymentApproved('PAYMENT_APPROVED'),
  picking('PICKING'),
  outForDelivery('OUT_FOR_DELIVERY'),
  delivered('DELIVERED');

  const OrderStatus(this.backendCode);

  final String backendCode;

  /// Status com o [code] da API, ou `null` se o código for desconhecido.
  static OrderStatus? fromBackendCode(String code) {
    for (final value in values) {
      if (value.backendCode == code) return value;
    }
    return null;
  }
}
