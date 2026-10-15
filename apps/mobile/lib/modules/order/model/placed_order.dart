/// Pedido recém-criado por `POST /me/orders`: só o id, que leva ao
/// acompanhamento. A entidade completa do pedido nasce na etapa 13.
final class PlacedOrder {
  const PlacedOrder(this.id);

  final String id;

  /// Número exibido ao cliente: os 8 primeiros caracteres do id em
  /// maiúsculas, como o `formatOrderNumber` de
  /// `apps/frontend/src/modules/orders/data/order.util.ts`.
  String get number => (id.length > 8 ? id.substring(0, 8) : id).toUpperCase();

  @override
  bool operator ==(Object other) => other is PlacedOrder && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'PlacedOrder($id)';
}
