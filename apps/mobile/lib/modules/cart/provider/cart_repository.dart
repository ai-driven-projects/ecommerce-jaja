import '../../../core/result.dart';
import '../model/cart_state.dart';

/// Carrinho do cliente: as mudanças valem na hora em [state] e os preços vêm
/// da prévia da API. As falhas das regras levam os códigos de
/// `CartErrorCode` (`errors/cart_errors.dart`) e não mudam o carrinho.
abstract interface class CartRepository {
  CartState get state;

  /// Emite (broadcast) o estado a cada mudança.
  Stream<CartState> get changes;

  /// Soma [quantity] ao produto ou o inclui no fim.
  Future<Result<void>> add(String productId, int quantity);

  /// Define a quantidade do produto; 0 o remove.
  Future<Result<void>> setQuantity(String productId, int quantity);

  /// Tira o produto. Nunca falha.
  Future<void> remove(String productId);

  /// Pede a prévia de novo, na hora (o "Tentar de novo").
  void refresh();
}
