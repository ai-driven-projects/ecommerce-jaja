import 'order_number.dart';

/// Pedido recém-criado por `POST /me/orders`: só o id, que leva ao
/// acompanhamento. O pedido completo é o `OrderDetail`.
final class PlacedOrder {
  const PlacedOrder(this.id);

  final String id;

  /// Número exibido ao cliente ([orderNumberOf]).
  String get number => orderNumberOf(id);

  @override
  bool operator ==(Object other) => other is PlacedOrder && other.id == id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'PlacedOrder($id)';
}
